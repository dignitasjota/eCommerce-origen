'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';

export interface CartItem {
    id: string; // Un identificador único para el item en el carrito (product_id + variant_id opcional)
    product_id: string;
    variant_id?: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    attributes?: Record<string, string>; // Ej: { Talla: "M", Color: "Rojo" }
}

interface CartState {
    items: CartItem[];
    totalQuantity: number;
    subtotal: number;
    isInitialized: boolean;
}

type CartAction =
    | { type: 'ADD_ITEM'; payload: CartItem }
    | { type: 'REMOVE_ITEM'; payload: string }
    | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
    | { type: 'CLEAR_CART' }
    | { type: 'SET_CART'; payload: CartItem[] };

const initialState: CartState = {
    items: [],
    totalQuantity: 0,
    subtotal: 0,
    isInitialized: false,
};

// Calculate totals from items array
const calculateTotals = (items: CartItem[]) => {
    return items.reduce(
        (acc, item) => ({
            totalQuantity: acc.totalQuantity + item.quantity,
            subtotal: acc.subtotal + item.price * item.quantity,
        }),
        { totalQuantity: 0, subtotal: 0 }
    );
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
    let newItems: CartItem[];

    switch (action.type) {
        case 'ADD_ITEM': {
            const existingItemIndex = state.items.findIndex(i => i.id === action.payload.id);
            if (existingItemIndex > -1) {
                // Item exists, update quantity
                newItems = [...state.items];
                newItems[existingItemIndex].quantity += action.payload.quantity;
            } else {
                // New item
                newItems = [...state.items, action.payload];
            }
            break;
        }
        case 'REMOVE_ITEM': {
            newItems = state.items.filter(item => item.id !== action.payload);
            break;
        }
        case 'UPDATE_QUANTITY': {
            if (action.payload.quantity <= 0) {
                newItems = state.items.filter(item => item.id !== action.payload.id);
            } else {
                newItems = state.items.map(item =>
                    item.id === action.payload.id ? { ...item, quantity: action.payload.quantity } : item
                );
            }
            break;
        }
        case 'CLEAR_CART': {
            newItems = [];
            break;
        }
        case 'SET_CART': {
            newItems = action.payload;
            state.isInitialized = true;
            break;
        }
        default:
            return state;
    }

    const totals = calculateTotals(newItems);

    // Solo guardamos en LocalStorage si ya ha sido inicializado desde él (evita sobreescribir con vacío al inicio)
    if (state.isInitialized || action.type === 'SET_CART') {
        try {
            localStorage.setItem('eshop_cart', JSON.stringify(newItems));
        } catch (e) {
            console.error('No se pudo guardar el carrito en LocalStorage', e);
        }
    }

    return {
        ...state,
        items: newItems,
        ...totals,
    };
};

interface CartContextProps {
    state: CartState;
    addItem: (item: CartItem) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
}

const CartContext = createContext<CartContextProps | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(cartReducer, initialState);

    // Initialize cart from LocalStorage on mount (client side only)
    useEffect(() => {
        try {
            const savedCart = localStorage.getItem('eshop_cart');
            if (savedCart) {
                const parsedCart = JSON.parse(savedCart);
                if (Array.isArray(parsedCart)) {
                    dispatch({ type: 'SET_CART', payload: parsedCart });
                }
            } else {
                dispatch({ type: 'SET_CART', payload: [] }); // Marcar como inicializado sin items
            }
        } catch (e) {
            console.error('Error al parsear el carrito de LocalStorage', e);
            dispatch({ type: 'SET_CART', payload: [] });
        }
    }, []);

    const addItem = (item: CartItem) => dispatch({ type: 'ADD_ITEM', payload: item });
    const removeItem = (id: string) => dispatch({ type: 'REMOVE_ITEM', payload: id });
    const updateQuantity = (id: string, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    const clearCart = () => dispatch({ type: 'CLEAR_CART' });

    return (
        <CartContext.Provider value={{ state, addItem, removeItem, updateQuantity, clearCart }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart debe ser usado dentro de un CartProvider');
    }
    return context;
};
