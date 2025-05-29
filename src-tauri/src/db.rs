use anyhow::Result;
use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;
use crate::keyboard::KeyStat;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyRankingItem {
    pub key_code: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub id: i64,
    pub name: String,
    pub bundle_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyStatsByDay {
    pub ts_day: i64,
    pub key_code: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DateRange {
    pub min: i64,
    pub max: i64,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    #[allow(dead_code)]
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn: Mutex::new(conn) };
        db.init()?;
        Ok(db)
    }

    #[allow(dead_code)]
    fn init(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                bundle_id TEXT NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS key_stat (
                ts_day INTEGER NOT NULL,
                key_code TEXT NOT NULL,
                app_id INTEGER NOT NULL,
                count INTEGER NOT NULL,
                PRIMARY KEY (ts_day, key_code, app_id),
                FOREIGN KEY (app_id) REFERENCES app(id)
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS excluded_app (
                app_id INTEGER PRIMARY KEY,
                FOREIGN KEY (app_id) REFERENCES app(id)
            )",
            [],
        )?;

        Ok(())
    }

    pub fn get_or_create_app(&self, name: &str, bundle_id: &str) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let app_id: i64 = conn.query_row(
            "SELECT id FROM app WHERE bundle_id = ?1",
            params![bundle_id],
            |row| row.get(0),
        ).unwrap_or_else(|_| {
            conn.execute(
                "INSERT INTO app (name, bundle_id) VALUES (?1, ?2)",
                params![name, bundle_id],
            ).unwrap();
            conn.last_insert_rowid()
        });
        Ok(app_id)
    }

    pub fn batch_insert_key_stats(&self, stats: &[KeyStat]) -> anyhow::Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        for stat in stats {
            tx.execute(
                "INSERT INTO key_stat (ts_day, key_code, app_id, count)
                VALUES (?1, ?2, ?3, 1)
                ON CONFLICT(ts_day, key_code, app_id)
                DO UPDATE SET count = count + 1",
                rusqlite::params![stat.ts_day, stat.key_code, stat.app_id], // ←ここ
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_key_ranking(&self, start_date: Option<i64>, end_date: Option<i64>, app_id: Option<i64>, limit: Option<i64>) -> Result<Vec<KeyRankingItem>> {
        let conn = self.conn.lock().unwrap();
        let mut query = "SELECT key_code, SUM(count) as total_count FROM key_stat".to_string();
        let mut conditions = Vec::new();
        let mut params_vec = Vec::new();

        if let Some(start) = start_date {
            conditions.push("ts_day >= ?".to_string());
            params_vec.push(start.to_string());
        }
        if let Some(end) = end_date {
            conditions.push("ts_day <= ?".to_string());
            params_vec.push(end.to_string());
        }
        if let Some(app) = app_id {
            conditions.push("app_id = ?".to_string());
            params_vec.push(app.to_string());
        }

        if !conditions.is_empty() {
            query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
        }

        query.push_str(" GROUP BY key_code ORDER BY total_count DESC");
        
        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(KeyRankingItem {
                key_code: row.get(0)?,
                count: row.get(1)?,
            })
        })?;

        let mut ranking = Vec::new();
        for row in rows {
            ranking.push(row?);
        }
        Ok(ranking)
    }

    pub fn get_apps(&self) -> Result<Vec<AppInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, bundle_id FROM app ORDER BY name")?;
        let rows = stmt.query_map([], |row| {
            Ok(AppInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                bundle_id: row.get(2)?,
            })
        })?;

        let mut apps = Vec::new();
        for row in rows {
            apps.push(row?);
        }
        Ok(apps)
    }

    #[allow(dead_code)]
    pub fn get_key_stats_by_day(&self, start_date: Option<i64>, end_date: Option<i64>, app_id: Option<i64>) -> Result<Vec<KeyStatsByDay>> {
        let conn = self.conn.lock().unwrap();
        let mut query = "SELECT ts_day, key_code, SUM(count) as total_count FROM key_stat".to_string();
        let mut conditions = Vec::new();
        let mut params_vec = Vec::new();

        if let Some(start) = start_date {
            conditions.push("ts_day >= ?".to_string());
            params_vec.push(start.to_string());
        }
        if let Some(end) = end_date {
            conditions.push("ts_day <= ?".to_string());
            params_vec.push(end.to_string());
        }
        if let Some(app) = app_id {
            conditions.push("app_id = ?".to_string());
            params_vec.push(app.to_string());
        }

        if !conditions.is_empty() {
            query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
        }

        query.push_str(" GROUP BY ts_day, key_code ORDER BY ts_day, total_count DESC");

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(KeyStatsByDay {
                ts_day: row.get(0)?,
                key_code: row.get(1)?,
                count: row.get(2)?,
            })
        })?;

        let mut stats = Vec::new();
        for row in rows {
            stats.push(row?);
        }
        Ok(stats)
    }

    pub fn get_total_key_count(&self, start_date: Option<i64>, end_date: Option<i64>, app_id: Option<i64>) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let mut query = "SELECT SUM(count) FROM key_stat".to_string();
        let mut conditions = Vec::new();
        let mut params_vec = Vec::new();

        if let Some(start) = start_date {
            conditions.push("ts_day >= ?".to_string());
            params_vec.push(start.to_string());
        }
        if let Some(end) = end_date {
            conditions.push("ts_day <= ?".to_string());
            params_vec.push(end.to_string());
        }
        if let Some(app) = app_id {
            conditions.push("app_id = ?".to_string());
            params_vec.push(app.to_string());
        }

        if !conditions.is_empty() {
            query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        
        let total: Option<i64> = stmt.query_row(params_refs.as_slice(), |row| row.get(0))?;
        Ok(total.unwrap_or(0))
    }

    pub fn get_date_range(&self) -> Result<DateRange> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT MIN(ts_day), MAX(ts_day) FROM key_stat")?;
        let (min, max): (Option<i64>, Option<i64>) = stmt.query_row([], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;
        Ok(DateRange {
            min: min.unwrap_or(0),
            max: max.unwrap_or(0),
        })
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn setup_test_db() -> (Database, NamedTempFile) {
        let temp_file = NamedTempFile::new().unwrap();
        let db = Database::new(temp_file.path()).unwrap();
        (db, temp_file)
    }

    #[test]
    fn test_record_key_press() {
        let (db, _temp_file) = setup_test_db();
        let app_id = db.get_or_create_app("Test App", "com.test.app").unwrap();
        let key_code = "KeyA";
        let now = chrono::Utc::now().date_naive();
        let ts_day = now.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
        let key_stat = KeyStat { ts_day, key_code: key_code.to_string(), app_id };
        db.batch_insert_key_stats(&[key_stat]).unwrap();
        let conn = db.conn.lock().unwrap();
        let count: i32 = conn.query_row(
            "SELECT count FROM key_stat WHERE ts_day = ?1 AND key_code = ?2 AND app_id = ?3",
            params![ts_day, key_code, app_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }
} 