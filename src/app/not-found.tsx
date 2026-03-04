export default function RootNotFound() {
    return (
        <div style={{ padding: '40px', fontFamily: 'monospace', background: '#f8d7da', minHeight: '50vh' }}>
            <h1 style={{ color: '#721c24' }}>NOT-FOUND desde app/not-found.tsx (ROOT)</h1>
            <p>Si ves este mensaje rojo, el 404 viene de la raíz de la app — la URL no matcheó ninguna ruta en absoluto.</p>
        </div>
    );
}
