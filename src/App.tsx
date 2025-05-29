import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Card,
  CardContent,
  Button,
  Grid,
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  IconButton,
  useMediaQuery,
  Menu,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  Brightness4,
  Brightness7,
  Refresh,
  Storage,
  ExitToApp,
} from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { setTheme } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import 'dayjs/locale/ja';
import { listen } from '@tauri-apps/api/event';
import '@fontsource-variable/noto-sans-jp';
import '@fontsource/lato';
import {
  jpLayout,
  usLayout,
  type KeyDef,
  formatKeyCode,
} from './lib/keyboardLayout';
import { open, save } from '@tauri-apps/plugin-dialog';
import { load, type Store } from '@tauri-apps/plugin-store';

dayjs.locale('ja');

interface KeyRankingItem {
  key_code: string;
  count: number;
}

interface AppInfo {
  id: number;
  name: string;
  bundle_id: string;
  totalCount?: number;
}

const presets = [
  { label: 'All', getRange: (min: Dayjs, max: Dayjs) => [min, max] },
  { label: '1 Year', getRange: () => [dayjs().subtract(1, 'year'), dayjs()] },
  {
    label: '6 Months',
    getRange: () => [dayjs().subtract(6, 'month'), dayjs()],
  },
  {
    label: '3 Months',
    getRange: () => [dayjs().subtract(3, 'month'), dayjs()],
  },
  { label: '1 Month', getRange: () => [dayjs().subtract(1, 'month'), dayjs()] },
  { label: '1 Week', getRange: () => [dayjs().subtract(1, 'week'), dayjs()] },
];

function App() {
  const [darkMode, setDarkMode] = useState(
    useMediaQuery('(prefers-color-scheme: dark)'),
  );
  const [startDate, setStartDate] = useState<Dayjs | null>(
    dayjs().subtract(7, 'day'),
  );
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [selectedApp, setSelectedApp] = useState<number | 'all'>('all');
  const [keyRanking, setKeyRanking] = useState<KeyRankingItem[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [preset, setPreset] = useState<string>('All');
  const [allAppsTotal, setAllAppsTotal] = useState<number>(0);
  const [store, setStore] = useState<Store | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<KeyDef[][]>(jpLayout);
  const [selectedLayoutName, setSelectedLayoutName] = useState<string>('JP');
  const [dbMenuAnchor, setDbMenuAnchor] = useState<null | HTMLElement>(null);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#34a3dd',
      },
    },
    typography: {
      fontFamily:
        '"Lato", "Noto Sans JP", "Roboto", "Helvetica", "Arial", sans-serif',
    },
  });

  const loadApps = useCallback(async () => {
    try {
      const result = await invoke<AppInfo[]>('get_apps');
      // 各アプリごとにタイプ数を取得
      const appsWithCount = await Promise.all(
        result.map(async (app) => {
          const count = await invoke<number>('get_total_key_count', {
            appId: app.id,
          });
          return { ...app, totalCount: count };
        }),
      );
      setApps(appsWithCount);

      // All Apps分も取得
      const allCount = await invoke<number>('get_total_key_count', {
        appId: null,
      });
      setAllAppsTotal(allCount);
    } catch (error) {
      console.error('Failed to load apps:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const startTimestamp = startDate ? startDate.startOf('day').unix() : null;
      const endTimestamp = endDate ? endDate.endOf('day').unix() : null;
      const appId = selectedApp === 'all' ? null : selectedApp;

      const [ranking, total] = await Promise.all([
        invoke<KeyRankingItem[]>('get_key_ranking', {
          startDate: startTimestamp,
          endDate: endTimestamp,
          appId,
        }),
        invoke<number>('get_total_key_count', {
          startDate: startTimestamp,
          endDate: endTimestamp,
          appId,
        }),
      ]);

      setKeyRanking(ranking);
      setTotalCount(total);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [startDate, endDate, selectedApp]);

  const checkMonitoringStatus = useCallback(async () => {
    try {
      const status = await invoke<boolean>('get_monitoring_status');
      setIsMonitoring(status);
    } catch (error) {
      console.error('Failed to check monitoring status:', error);
    }
  }, []);

  useEffect(() => {
    loadApps();
    loadData();
    checkMonitoringStatus();
  }, [loadApps, loadData, checkMonitoringStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleMonitoring = async () => {
    try {
      await invoke('toggle_monitoring');
      // 状態を明示的に再取得
      const status = await invoke<boolean>('get_monitoring_status');
      setIsMonitoring(status);
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    }
  };

  const chartData = keyRanking.map((item, index) => {
    const rank = (index + 1).toString();
    return {
      key: `${rank}: ${formatKeyCode(item.key_code)}`,
      count: item.count,
    };
  });

  const fetchDateRange = useCallback(async () => {
    return await invoke<{ min: number; max: number }>(
      'get_key_stat_date_range',
    );
  }, []);

  // --- ヒートマップ描画用関数 ---
  const keyCountMap = keyRanking.reduce(
    (acc, item) => {
      acc[item.key_code] = item.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  function getHeatColor(count: number, min: number, max: number) {
    if (max === min) return '#fff';
    const ratio = (count - min) / (max - min);
    const r = 255;
    const g = Math.round(255 * (1 - ratio));
    const b = Math.round(255 * (1 - ratio));
    return `rgb(${r},${g},${b})`;
  }

  const keyWidth = 50;
  const keyHeight = 50;
  const keyGap = 6;
  const svgPadding = 20;

  // 各行の最大横幅を計算
  const getRowWidth = (row: KeyDef[]) => {
    let offset = 0;
    let x = 0;
    let maxX = 0;
    row.forEach((key, colIdx) => {
      if (key.xOffset) offset += key.xOffset;
      const width =
        (key.width || 1) * keyWidth +
        (key.width ? (key.width - 1) * keyGap : 0);
      x = (colIdx + offset) * (keyWidth + keyGap) + width;
      if (x > maxX) maxX = x;
    });
    return maxX;
  };
  const svgWidth =
    Math.max(...selectedLayout.map(getRowWidth)) + svgPadding * 2;
  const svgHeight =
    selectedLayout.length * (keyHeight + keyGap) + svgPadding * 2;

  const counts = Object.values(keyCountMap);
  let minCount = 0;
  let maxCount = 1;
  if (counts.length > 0) {
    minCount = Math.min(...counts);
    maxCount = Math.max(...counts);
  }

  useEffect(() => {
    const unlistenPromise = listen<boolean>(
      'monitoring_status_changed',
      (event) => {
        setIsMonitoring(event.payload);
      },
    );
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    // プリセットがAllの場合は自動で範囲をセット
    if (preset === 'All') {
      fetchDateRange().then(({ min, max }) => {
        setStartDate(dayjs.unix(min));
        setEndDate(dayjs.unix(max));
      });
    }
  }, [preset, fetchDateRange]);

  const handleExport = async () => {
    setDbMenuAnchor(null);
    const now = dayjs().format('YYYYMMDD_HHmmss');
    const filePath = await save({
      title: 'Select location to export database',
      filters: [{ name: 'Database', extensions: ['db'] }],
      defaultPath: `keyfit_backup_${now}.db`,
    });
    if (filePath) {
      try {
        await invoke('export_database', { exportPath: filePath });
        alert('Export successful.');
      } catch (e) {
        alert(`Export failed: ${e}`);
      }
    }
  };

  const handleImport = async () => {
    setDbMenuAnchor(null);
    const filePath = await open({
      title: 'Select a database file to import',
      filters: [{ name: 'Database', extensions: ['db'] }],
      multiple: false,
    });
    if (filePath) {
      try {
        await invoke('import_database', { importPath: filePath });
        alert(
          'Import successful. Please restart the application to apply the new database.',
        );
      } catch (e) {
        alert(`Import failed: ${e}`);
      }
    }
  };

  useEffect(() => {
    (async () => {
      const loadedStore = await load('store.json', { autoSave: false });
      setStore(loadedStore);
      const layout = await loadedStore.get<{ value: string }>('keyLayout');
      const layoutValue = layout?.value || 'JP';
      setSelectedLayout(layoutValue === 'US' ? usLayout : jpLayout);
      setSelectedLayoutName(layoutValue);
    })();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          height: '100%',
          backgroundColor: 'divider',
          pt: 5,
          pb: 1,
        }}
      >
        <AppBar
          position="fixed"
          elevation={1}
          sx={{ height: 50, justifyContent: 'center' }}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Keyboard Usage Analytics
            </Typography>
            <Button
              color="inherit"
              onClick={toggleMonitoring}
              variant="outlined"
              sx={{ mr: 2, textTransform: 'none' }}
            >
              {isMonitoring
                ? 'Monitoring Status: ✅ Monitoring'
                : 'Monitoring Status: ❌ Stopped'}
            </Button>
            <IconButton
              color="inherit"
              onClick={async () => {
                setDarkMode(!darkMode);
                await setTheme(darkMode ? 'dark' : 'light');
                await getCurrentWindow().setTheme(darkMode ? 'dark' : 'light');
              }}
            >
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
            <IconButton
              color="inherit"
              onClick={async () => {
                await loadApps();
                await loadData();
              }}
              sx={{ ml: 1 }}
              title="Refresh"
            >
              <Refresh />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={(e) => setDbMenuAnchor(e.currentTarget)}
              sx={{ ml: 1 }}
              title="Database Import/Export"
            >
              <Storage />
            </IconButton>
            <Menu
              anchorEl={dbMenuAnchor}
              open={Boolean(dbMenuAnchor)}
              onClose={() => setDbMenuAnchor(null)}
            >
              <MenuItem onClick={handleImport}>Import Log</MenuItem>
              <MenuItem onClick={handleExport}>Export Log</MenuItem>
            </Menu>
            <IconButton
              color="inherit"
              onClick={() => {
                invoke('quit_app');
              }}
              sx={{ ml: 1 }}
              title="Quit"
            >
              <ExitToApp />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 3, mb: 1 }}>
          <Grid container spacing={2}>
            {/* 上段：横並び2つ */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 4 }}>
                    <FormControl size="small" sx={{ width: '100%', mr: -1 }}>
                      <InputLabel id="preset-label">Range Preset</InputLabel>
                      <Select
                        labelId="preset-label"
                        value={preset}
                        label="Range Preset"
                        onChange={async (e) => {
                          const selected = presets.find(
                            (p) => p.label === e.target.value,
                          );
                          setPreset(e.target.value);
                          if (selected) {
                            if (selected.label === 'All') {
                              const { min, max } = await fetchDateRange();
                              console.log(min, max);
                              setStartDate(dayjs.unix(min));
                              setEndDate(dayjs.unix(max));
                            } else if (startDate && endDate) {
                              const [start, end] = selected.getRange(
                                startDate,
                                endDate,
                              );
                              setStartDate(start);
                              setEndDate(end);
                            }
                          }
                        }}
                      >
                        {presets.map((p) => (
                          <MenuItem key={p.label} value={p.label}>
                            {p.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <LocalizationProvider
                    dateAdapter={AdapterDayjs}
                    adapterLocale="ja"
                  >
                    <Grid size={{ xs: 4 }}>
                      <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={setStartDate}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { width: '100%' },
                          },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={setEndDate}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { width: '100%' },
                          },
                        }}
                      />
                    </Grid>
                  </LocalizationProvider>
                </Grid>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Grid container spacing={2} alignItems="stretch">
                <Grid size={{ xs: 7 }}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>App</InputLabel>
                      <Select
                        value={selectedApp}
                        label="App"
                        onChange={(e) =>
                          setSelectedApp(e.target.value as number | 'all')
                        }
                      >
                        <MenuItem value="all">
                          All Apps（{allAppsTotal.toLocaleString()}）
                        </MenuItem>
                        {apps.map((app) => (
                          <MenuItem key={app.id} value={app.id}>
                            {app.name}（
                            {app.totalCount?.toLocaleString() ?? '-'}）
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 5 }}>
                  <Paper
                    sx={{
                      height: '100%',
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}
                  >
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      Total Typed: {totalCount.toLocaleString()} /{' '}
                      {allAppsTotal.toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            {/* チャート */}
            <Grid size={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ranking
                  </Typography>
                  <Box
                    sx={{
                      maxHeight: 300,
                      overflowY: 'auto',
                    }}
                  >
                    {chartData.length > 0 && (
                      <BarChart
                        dataset={chartData}
                        colors={['#34a3dd']}
                        yAxis={[{ scaleType: 'band', dataKey: 'key' }]}
                        series={[{ dataKey: 'count' }]}
                        layout="horizontal"
                        barLabel="value"
                        margin={{ left: 100, right: 0, top: 0, bottom: 0 }}
                        sx={{
                          width: '100% !important',
                          '& .MuiChartsAxis-tickLabel': {
                            x: '-100 !important',
                            textAnchor: 'end !important',
                            fontFamily: 'monospace',
                          },
                          '& .MuiChartsAxis-tickLabel tspan': {
                            x: '-100 !important',
                          },
                        }}
                        height={Math.max(350, chartData.length * 25)}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* ヒートマップ */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 10 }}>
                      <Typography variant="h6" gutterBottom>
                        Heatmap
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 2 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Keyboard Layout</InputLabel>
                        <Select
                          value={selectedLayoutName}
                          label="KeyboardLayout"
                          onChange={async (e) => {
                            if (!store) return;
                            if (e.target.value === 'JP') {
                              setSelectedLayout(jpLayout);
                              setSelectedLayoutName('JP');
                              await store.set('keyLayout', { value: 'JP' });
                            } else {
                              setSelectedLayout(usLayout);
                              setSelectedLayoutName('US');
                              await store.set('keyLayout', { value: 'US' });
                            }
                          }}
                        >
                          <MenuItem value="JP">JP</MenuItem>
                          <MenuItem value="US">US</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  <Box sx={{ overflowX: 'auto', width: '100%' }}>
                    <svg width={svgWidth} height={svgHeight}>
                      <title>Key Heatmap</title>
                      {selectedLayout.map((row, rowIdx) => {
                        let offset = 0;
                        return row.map((key, colIdx) => {
                          if (!key.code) return null;
                          if (key.xOffset) {
                            offset += key.xOffset;
                          }
                          const count = keyCountMap[key.code] || 0;
                          const color = getHeatColor(count, minCount, maxCount);
                          const width =
                            (key.width || 1) * keyWidth +
                            (key.width ? (key.width - 1) * keyGap : 0);
                          const height = key.height ? key.height + 0.14 : 1;
                          const x =
                            svgPadding +
                            (colIdx + offset) * (keyWidth + keyGap);
                          const y = svgPadding + rowIdx * (keyHeight + keyGap);
                          return (
                            <g key={`${rowIdx}-${colIdx}-${key.code}`}>
                              <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height * keyHeight}
                                rx={6}
                                fill={color}
                                stroke="#aaa"
                              />
                              <text
                                x={x + width / 2}
                                y={y + keyHeight / 2 + 6}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#222"
                              >
                                {key.label}
                              </text>
                            </g>
                          );
                        });
                      })}
                    </svg>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
