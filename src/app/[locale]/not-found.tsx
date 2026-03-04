export default function NotFound() {
    return (
        <div style={{ padding: '40px', fontFamily: 'monospace', background: '#fff3cd', minHeight: '50vh' }}>
            <h1 style={{ color: '#856404' }}>NOT-FOUND desde [locale]/not-found.tsx</h1>
            <p>Si ves este mensaje amarillo, el 404 viene del layout de locale (el locale no se reconoció como es/en).</p>
            <p>Si NO ves este mensaje y ves el 404 blanco por defecto, el problema está antes del routing de Next.js.</p>
        </div>
    );
}
