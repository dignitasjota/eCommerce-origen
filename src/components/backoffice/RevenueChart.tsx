interface DataPoint {
    label: string;
    value: number;
}

interface RevenueChartProps {
    data: DataPoint[];
    height?: number;
    formatValue?: (n: number) => string;
}

/**
 * Mini gráfico de barras SVG inline. Sin librerías: usar `recharts` añade
 * ~100KB al bundle del admin para algo que en un dashboard básico se resuelve
 * con 30 líneas de SVG. Si en el futuro se piden tooltips/zoom, migrar.
 *
 * Diseño: 100% width responsive, altura fija. Cada barra tiene aspecto
 * uniforme, etiqueta debajo y el valor encima. Si todos los puntos son 0
 * mostramos un mensaje en lugar de barras planas.
 */
export default function RevenueChart({ data, height = 160, formatValue }: RevenueChartProps) {
    if (data.length === 0) {
        return <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Sin datos en el rango.</p>;
    }
    const max = Math.max(...data.map((d) => d.value), 1);
    const fmt = formatValue ?? ((n: number) => n.toFixed(0));

    if (data.every((d) => d.value === 0)) {
        return <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Sin movimiento aún en este período.</p>;
    }

    const barGap = 4;
    const totalGap = barGap * (data.length - 1);
    const barW = `calc((100% - ${totalGap}px) / ${data.length})`;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: `${barGap}px`, height, padding: '1rem 0', borderBottom: '1px solid var(--color-border)' }}>
                {data.map((d, i) => {
                    const h = Math.max(2, Math.round((d.value / max) * (height - 30)));
                    return (
                        <div
                            key={i}
                            title={`${d.label}: ${fmt(d.value)}`}
                            style={{
                                width: barW,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 4
                            }}
                        >
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>{fmt(d.value)}</span>
                            <div
                                style={{
                                    width: '100%',
                                    height: `${h}px`,
                                    background: 'linear-gradient(to top, var(--color-primary), var(--color-primary-light, var(--color-primary)))',
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'background 0.2s'
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: `${barGap}px`, marginTop: 4 }}>
                {data.map((d, i) => (
                    <span key={i} style={{ width: barW, fontSize: '0.7rem', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                        {d.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
