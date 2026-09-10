interface WhatsAppButtonProps {
    /** Número en formato internacional (dígitos, con código de país). Sin esto no se renderiza nada. */
    phone?: string;
    /** Mensaje precargado en el chat. */
    defaultMessage?: string;
}

/**
 * Botón flotante que abre un chat de WhatsApp (`wa.me`) en una pestaña
 * nueva. No requiere JS del lado cliente (es un `<a>` normal) ni SDK
 * externo — WhatsApp Business no ofrece un widget embebible oficial y
 * gratuito, así que el patrón estándar del sector es enlazar directamente a
 * `wa.me` con el número y un mensaje precargado.
 */
export default function WhatsAppButton({ phone, defaultMessage }: WhatsAppButtonProps) {
    const digitsOnly = (phone || '').replace(/[^0-9]/g, '');
    if (!digitsOnly) return null;

    const href = `https://wa.me/${digitsOnly}${defaultMessage ? `?text=${encodeURIComponent(defaultMessage)}` : ''}`;

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chatear por WhatsApp"
            title="Chatear por WhatsApp"
            style={{
                position: 'fixed',
                bottom: '90px',
                right: '20px',
                zIndex: 890,
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
            }}
        >
            <svg aria-hidden="true" focusable="false" width="30" height="30" viewBox="0 0 24 24" fill="white">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.24-.86.84-.86 2.05 0 1.22.89 2.39 1.01 2.55.12.17 1.75 2.68 4.25 3.75.59.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29z" />
            </svg>
        </a>
    );
}
