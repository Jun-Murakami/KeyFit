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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { BarChart } from '@mui/x-charts/BarChart';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { setTheme } from '@tauri-apps/api/app';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import 'dayjs/locale/ja';
import { listen } from '@tauri-apps/api/event';
import '@fontsource-variable/noto-sans-jp';
import '@fontsource/lato';

dayjs.locale('ja');

type KeyDef = {
  code: string;
  label: string;
  xOffset?: number;
  width?: number;
  height?: number;
};

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

const jp109Layout: KeyDef[][] = [
  [
    { code: 'Escape', label: 'Esc' },
    { code: 'F1', label: 'F1', xOffset: 1 },
    { code: 'F2', label: 'F2' },
    { code: 'F3', label: 'F3' },
    { code: 'F4', label: 'F4' },
    { code: 'F5', label: 'F5', xOffset: 0.33 },
    { code: 'F6', label: 'F6' },
    { code: 'F7', label: 'F7' },
    { code: 'F8', label: 'F8' },
    { code: 'F9', label: 'F9', xOffset: 0.33 },
    { code: 'F10', label: 'F10' },
    { code: 'F11', label: 'F11' },
    { code: 'F12', label: 'F12' },
    { code: 'PrintScreen', label: 'PrtSc', xOffset: 0.54 },
    { code: 'ScrollLock', label: 'Scroll' },
    { code: 'Pause', label: 'Pause' },
  ],
  [
    { code: 'Unknown(244)', label: '半角/全角' },
    { code: 'Num1', label: '1' },
    { code: 'Num2', label: '2' },
    { code: 'Num3', label: '3' },
    { code: 'Num4', label: '4' },
    { code: 'Num5', label: '5' },
    { code: 'Num6', label: '6' },
    { code: 'Num7', label: '7' },
    { code: 'Num8', label: '8' },
    { code: 'Num9', label: '9' },
    { code: 'Num0', label: '0' },
    { code: 'Minus', label: '-' },
    { code: 'Quote', label: '^' },
    { code: 'BackSlash', label: '¥' },
    { code: 'Backspace', label: 'BackSpace' },
    { code: 'Insert', label: 'Insert', xOffset: 0.2 },
    { code: 'Home', label: 'Home' },
    { code: 'PageUp', label: 'PageUp' },
    { code: 'NumLock', label: 'NumLock', xOffset: 0.2 },
    { code: 'KpDivide', label: '/' },
    { code: 'KpMultiply', label: '*' },
    { code: 'KpMinus', label: '-' },
  ],
  [
    { code: 'Tab', label: 'Tab', width: 1.5 },
    { code: 'KeyQ', label: 'Q', xOffset: 0.5 },
    { code: 'KeyW', label: 'W' },
    { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' },
    { code: 'KeyT', label: 'T' },
    { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' },
    { code: 'KeyI', label: 'I' },
    { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
    { code: 'BackQuote', label: '@' },
    { code: 'LeftBracket', label: '[' },
    { code: 'Return', label: 'Enter', width: 1.5 },
    { code: 'Delete', label: 'Delete', xOffset: 0.7 },
    { code: 'End', label: 'End' },
    { code: 'PageDown', label: 'PageDown' },
    { code: 'Kp7', label: '7', xOffset: 0.2 },
    { code: 'Kp8', label: '8' },
    { code: 'Kp9', label: '9' },
    { code: 'KpPlus', label: '+', height: 2 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', width: 1.7 },
    { code: 'KeyA', label: 'A', xOffset: 0.7 },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G' },
    { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' },
    { code: 'KeyK', label: 'K' },
    { code: 'KeyL', label: 'L' },
    { code: 'Equal', label: ';' },
    { code: 'Semicolon', label: ':' },
    { code: 'RightBracket', label: ']' },
    { code: '', label: '' },
    { code: '', label: '' },
    { code: '', label: '' },
    { code: 'Kp4', label: '4', xOffset: 1.7 },
    { code: 'Kp5', label: '5' },
    { code: 'Kp6', label: '6' },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', width: 2 },
    { code: 'KeyZ', label: 'Z', xOffset: 1 },
    { code: 'KeyX', label: 'X' },
    { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' },
    { code: 'KeyB', label: 'B' },
    { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',' },
    { code: 'Dot', label: '.' },
    { code: 'Slash', label: '/' },
    { code: 'IntlBackslash', label: '\\' },
    { code: 'ShiftRight', label: 'Shift', width: 2 },
    { code: '', label: '' },
    { code: 'UpArrow', label: '↑', xOffset: 1.2 },
    { code: '', label: '' },
    { code: 'Kp1', label: '1', xOffset: 0.2 },
    { code: 'Kp2', label: '2' },
    { code: 'Kp3', label: '3' },
    { code: 'Return', label: 'Enter', height: 2 },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', width: 1.7 },
    { code: 'MetaLeft', label: 'Win/Opt', xOffset: 0.7 },
    { code: 'Alt', label: 'Alt/Cmd' },
    { code: 'Lang1', label: '無変換' },
    { code: 'Space', label: 'Space', width: 3 },
    { code: 'Lang2', label: '変換', xOffset: 2 },
    { code: 'KanaMode', label: 'カナ/かな' },
    { code: 'AltGr', label: 'Alt/Cmd' },
    { code: 'MetaRight', label: 'Win/Opt' },
    { code: 'Apps', label: 'Menu' },
    { code: 'ControlRight', label: 'Ctrl', width: 2.3 },
    { code: 'LeftArrow', label: '←', xOffset: 1.5 },
    { code: 'DownArrow', label: '↓' },
    { code: 'RightArrow', label: '→' },
    { code: 'Kp0', label: '0', width: 2, xOffset: 0.2 },
    { code: 'KpDecimal', label: '.', xOffset: 1 },
  ],
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

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
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
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    }
  };

  const formatKeyCode = (keyCode: string) => {
    // rdevのキーコードを日本語表示に変換
    const keyMap: { [key: string]: string } = {
      KeyA: 'A',
      KeyB: 'B',
      KeyC: 'C',
      KeyD: 'D',
      KeyE: 'E',
      KeyF: 'F',
      KeyG: 'G',
      KeyH: 'H',
      KeyI: 'I',
      KeyJ: 'J',
      KeyK: 'K',
      KeyL: 'L',
      KeyM: 'M',
      KeyN: 'N',
      KeyO: 'O',
      KeyP: 'P',
      KeyQ: 'Q',
      KeyR: 'R',
      KeyS: 'S',
      KeyT: 'T',
      KeyU: 'U',
      KeyV: 'V',
      KeyW: 'W',
      KeyX: 'X',
      KeyY: 'Y',
      KeyZ: 'Z',
      Backspace: 'BackSpace',
      Space: 'Space',
      Return: 'Enter',
      Tab: 'Tab',
      Escape: 'Esc',
      LeftShift: 'L-Shift',
      RightShift: 'R-Shift',
      LeftCtrl: 'L-Ctrl',
      RightCtrl: 'R-Ctrl',
      LeftAlt: 'L-Alt',
      RightAlt: 'R-Alt',
      'Unknown(244)': '半角/全角',
      KpDivide: 'KeyPad /',
      KpMultiply: 'KeyPad *',
      KpMinus: 'KeyPad -',
      KpPlus: 'KeyPad +',
      KpDecimal: 'KeyPad .',
      KpEqual: 'KeyPad =',
      Kp0: 'KeyPad 0',
      Kp1: 'KeyPad 1',
      Kp2: 'KeyPad 2',
      Kp3: 'KeyPad 3',
      Kp4: 'KeyPad 4',
      Kp5: 'KeyPad 5',
      Kp6: 'KeyPad 6',
      Kp7: 'KeyPad 7',
      Kp8: 'KeyPad 8',
      Kp9: 'KeyPad 9',
      Num0: 'Num 0',
      Num1: 'Num 1',
      Num2: 'Num 2',
      Num3: 'Num 3',
      Num4: 'Num 4',
      Num5: 'Num 5',
      Num6: 'Num 6',
      Num7: 'Num 7',
      Num8: 'Num 8',
      Num9: 'Num 9',
    };
    return keyMap[keyCode] || keyCode;
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
  const svgWidth = Math.max(...jp109Layout.map(getRowWidth)) + svgPadding * 2;
  const svgHeight = jp109Layout.length * (keyHeight + keyGap) + svgPadding * 2;

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
              }}
            >
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 3, mb: 3 }}>
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
                  <Typography variant="h6" gutterBottom>
                    Heatmap (JP)
                  </Typography>
                  <Box sx={{ overflowX: 'auto', width: '100%' }}>
                    <svg width={svgWidth} height={svgHeight}>
                      <title>Key Heatmap</title>
                      {jp109Layout.map((row, rowIdx) => {
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
