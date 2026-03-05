'use client';

import { useState } from 'react';

export default function ContactForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setIsSuccess(false);
        setIsError(false);

        const formData = new FormData(e.currentTarget);

        try {
            // Simulator: Wait 1 second to mock sending real email/db save
            await new Promise(resolve => setTimeout(resolve, 1000));
            // You can replace this later with a Real Server action
            console.log('Contacto enviado:', Object.fromEntries(formData));

            setIsSuccess(true);
            (e.target as HTMLFormElement).reset();
        } catch (error) {
            console.error('Error sending message', error);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text)] mb-2">Nombre Completo</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        placeholder="Juan Pérez"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all bg-gray-50/50"
                    />
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-2">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        placeholder="tu@email.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all bg-gray-50/50"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="subject" className="block text-sm font-medium text-[var(--color-text)] mb-2">Asunto</label>
                <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    placeholder="Quiero consultar sobre un pedido..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all bg-gray-50/50"
                />
            </div>

            <div>
                <label htmlFor="message" className="block text-sm font-medium text-[var(--color-text)] mb-2">Mensaje</label>
                <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Escribe tu mensaje aquí..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all bg-gray-50/50 resize-y"
                ></textarea>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all transform hover:-translate-y-1 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--color-primary)] hover:shadow-lg'}`}
            >
                {isLoading ? 'Enviando...' : 'Enviar Mensaje'}
            </button>

            {isSuccess && (
                <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-3 animate-fade-in">
                    <span className="text-xl">✅</span>
                    <p className="font-medium">¡Gracias por contactarnos! Hemos recibido tu mensaje y te responderemos pronto.</p>
                </div>
            )}

            {isError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3 animate-fade-in">
                    <span className="text-xl">❌</span>
                    <p className="font-medium">Hubo un error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.</p>
                </div>
            )}
        </form>
    );
}
