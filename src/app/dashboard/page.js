'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/dashboard');
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error); return; }
    setData(d);
  }

  useEffect(() => { load(); }, []);

  const chartData = [];
  if (data?.trend) {
    const byDate = {};
    for (const t of data.trend) {
      if (!byDate[t.tanggal]) byDate[t.tanggal] = { tanggal: t.tanggal.slice(5) };
      byDate[t.tanggal][t.target] = t.efWm;
    }
    chartData.push(...Object.values(byDate));
  }

  return (
    <div className="container">
      <Nav />
      <h1>Dashboard</h1>

      {loading && <div className="card">Memuat data...</div>}
      {error && <div className="card"><p className="error">{error}</p>
        <a href="/api/auth/ms/start"><button className="secondary">Hubungkan Microsoft (Owner)</button></a>
      </div>}

      {data?.live && (
        <>
          <div className="card">
            <h2>EF WM Terkini</h2>
            <div className="grid2">
              <div className="stat"><div className="val">{data.live.shiftA.efWm}</div><div className="lbl">Shift A · {data.live.shiftA.tanggal}</div></div>
              <div className="stat"><div className="val">{data.live.shiftB.efWm}</div><div className="lbl">Shift B · {data.live.shiftB.tanggal}</div></div>
              <div className="stat"><div className="val">{data.live.shiftC.efWm}</div><div className="lbl">Shift C · {data.live.shiftC.tanggal}</div></div>
              <div className="stat"><div className="val">{data.live.rekap.efWm}</div><div className="lbl">Rekap · {data.live.rekap.tanggal}</div></div>
            </div>
          </div>

          <div className="card">
            <h2>Tren EF WM per Shift</h2>
            {chartData.length === 0 && <p className="sub">Belum ada data untuk grafik.</p>}
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <XAxis dataKey="tanggal" fontSize={11} />
                  <YAxis domain={[0.30, 0.38]} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0.33} stroke="#d97706" strokeDasharray="4 4" />
                  <ReferenceLine y={0.361} stroke="#d97706" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="shiftA" name="Shift A" stroke="#0f6e56" dot={false} />
                  <Line type="monotone" dataKey="shiftB" name="Shift B" stroke="#534ab7" dot={false} />
                  <Line type="monotone" dataKey="shiftC" name="Shift C" stroke="#d85a30" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      <button className="secondary" onClick={load}>🔄 Refresh Data</button>
    </div>
  );
}
