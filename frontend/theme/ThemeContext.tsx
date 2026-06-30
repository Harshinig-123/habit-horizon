import { createContext, useContext, useState, type ReactNode } from 'react';

type Archetype = 'Student' | 'Professional' | 'Entrepreneur';

interface ThemeStyles {
    background: string;
    cardBg: string;
    text: string;
    accent: string;
    fontFamily: string;
    borderColor: string;
    inputBg: string;
}

interface ThemeContextType {
    archetype: Archetype;
    setArchetype: (arch: Archetype) => void;
    theme: ThemeStyles;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [archetype, setArchetype] = useState<Archetype>('Student');

    // Light, vibrant, and highly readable themes tailored to each persona
    const themes: Record<Archetype, ThemeStyles> = {
        Student: {
            background: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100',
            cardBg: 'bg-white/90 backdrop-blur border-2 border-amber-700/40 shadow-lg rounded-2xl',
            text: 'text-amber-950',
            accent: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-serif rounded-lg shadow-sm',
            borderColor: 'border-amber-200',
            inputBg: 'bg-amber-100/40 focus:bg-white',
            fontFamily: 'font-serif', // Energetic Classical / RPG Academy Vibe
        },
        Professional: {
            background: 'bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50',
            cardBg: 'bg-white/90 backdrop-blur border border-sky-200 shadow-md shadow-sky-100/50 rounded-2xl',
            text: 'text-slate-800',
            accent: 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-sans tracking-wide rounded-lg shadow-sm',
            borderColor: 'border-sky-100',
            inputBg: 'bg-slate-100/60 focus:bg-white',
            fontFamily: 'font-sans', // Clean, crisp, corporate productivity vibe
        },
        Entrepreneur: {
            background: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50',
            cardBg: 'bg-white/90 backdrop-blur border border-emerald-200 shadow-md shadow-emerald-100/50 rounded-2xl',
            text: 'text-teal-950',
            accent: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-mono uppercase tracking-wider rounded-lg shadow-sm',
            borderColor: 'border-emerald-100',
            inputBg: 'bg-emerald-50/50 focus:bg-white',
            fontFamily: 'font-mono', // High-energy, sharp startup execution vibe
        },
    };

    return (
        <ThemeContext.Provider value={{ archetype, setArchetype, theme: themes[archetype] }}>
            <div className={`min-h-screen p-6 transition-all duration-500 ${themes[archetype].background} ${themes[archetype].text} ${themes[archetype].fontFamily}`}>
                {children}
            </div>
        </ThemeContext.Provider>
    );
};

export const useAppTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useAppTheme must be used within a ThemeProvider');
    return context;
};