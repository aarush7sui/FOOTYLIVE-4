'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  History,
  Trophy,
  Calendar,
  MapPin,
  Sparkles,
  Award,
  Filter,
  Users,
  RotateCcw,
} from 'lucide-react';

export type HistoryCompetitionId = 'world-cup' | 'champions-league' | 'euro';

export interface TournamentEdition {
  year: number;
  host: string;
  champion: string;
  championFlag: string;
  runnerUp: string;
  finalScore: string;
  teamsCount: number;
  topScorer: string;
  milestone: string;
  eraTag: string;
}

interface CompetitionDataset {
  id: HistoryCompetitionId;
  name: string;
  shortName: string;
  foundedYear: number;
  originNote: string;
  accentColor: string;
  editions: TournamentEdition[];
}

const COMPETITIONS: Record<HistoryCompetitionId, CompetitionDataset> = {
  'world-cup': {
    id: 'world-cup',
    name: 'FIFA World Cup',
    shortName: 'World Cup (1930–2026)',
    foundedYear: 1930,
    originNote: 'Started in 1930 in Montevideo, Uruguay with 13 invited nations.',
    accentColor: '#00ff88',
    editions: [
      {
        year: 1930,
        host: 'Uruguay',
        champion: 'Uruguay',
        championFlag: '🇺🇾',
        runnerUp: 'Argentina',
        finalScore: '4 - 2',
        teamsCount: 13,
        topScorer: 'Guillermo Stábile (8)',
        milestone: 'Inaugural FIFA World Cup; no qualification stage, 13 invited teams.',
        eraTag: 'Origin Era',
      },
      {
        year: 1934,
        host: 'Italy',
        champion: 'Italy',
        championFlag: '🇮🇹',
        runnerUp: 'Czechoslovakia',
        finalScore: '2 - 1 (AET)',
        teamsCount: 16,
        topScorer: 'Oldřich Nejedlý (5)',
        milestone: 'First World Cup featuring qualification matches & knockout-only bracket.',
        eraTag: 'Origin Era',
      },
      {
        year: 1938,
        host: 'France',
        champion: 'Italy',
        championFlag: '🇮🇹',
        runnerUp: 'Hungary',
        finalScore: '4 - 2',
        teamsCount: 15,
        topScorer: 'Leônidas (7)',
        milestone: 'Italy becomes the first nation to successfully defend the World Cup.',
        eraTag: 'Origin Era',
      },
      {
        year: 1950,
        host: 'Brazil',
        champion: 'Uruguay',
        championFlag: '🇺🇾',
        runnerUp: 'Brazil',
        finalScore: '2 - 1',
        teamsCount: 13,
        topScorer: 'Ademir (8)',
        milestone: 'Post-WWII return & the Maracanazo before 173,850 fans in Rio.',
        eraTag: 'Classic Era',
      },
      {
        year: 1954,
        host: 'Switzerland',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Hungary',
        finalScore: '3 - 2',
        teamsCount: 16,
        topScorer: 'Sándor Kocsis (11)',
        milestone: 'Miracle of Bern; all-time highest tournament scoring average (5.38/match).',
        eraTag: 'Classic Era',
      },
      {
        year: 1958,
        host: 'Sweden',
        champion: 'Brazil',
        championFlag: '🇧🇷',
        runnerUp: 'Sweden',
        finalScore: '5 - 2',
        teamsCount: 16,
        topScorer: 'Just Fontaine (13)',
        milestone: '17-year-old Pelé scores twice in the final; Fontaine hits record 13 goals.',
        eraTag: 'Pelé Era',
      },
      {
        year: 1962,
        host: 'Chile',
        champion: 'Brazil',
        championFlag: '🇧🇷',
        runnerUp: 'Czechoslovakia',
        finalScore: '3 - 1',
        teamsCount: 16,
        topScorer: 'Garrincha & 5 others (4)',
        milestone: 'Garrincha inspires Brazil to back-to-back titles after Pelé injury.',
        eraTag: 'Pelé Era',
      },
      {
        year: 1966,
        host: 'England',
        champion: 'England',
        championFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        runnerUp: 'Germany',
        finalScore: '4 - 2 (AET)',
        teamsCount: 16,
        topScorer: 'Eusébio (9)',
        milestone: 'Geoff Hurst nets historic final hat-trick at Wembley.',
        eraTag: 'Classic Era',
      },
      {
        year: 1970,
        host: 'Mexico',
        champion: 'Brazil',
        championFlag: '🇧🇷',
        runnerUp: 'Italy',
        finalScore: '4 - 1',
        teamsCount: 16,
        topScorer: 'Gerd Müller (10)',
        milestone: 'First World Cup broadcast in color; Brazil keeps Jules Rimet Trophy.',
        eraTag: 'Pelé Era',
      },
      {
        year: 1974,
        host: 'West Germany',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Netherlands',
        finalScore: '2 - 1',
        teamsCount: 16,
        topScorer: 'Grzegorz Lato (7)',
        milestone: 'New FIFA World Cup Trophy introduced; Total Football reaches final.',
        eraTag: 'Tactical Shift',
      },
      {
        year: 1978,
        host: 'Argentina',
        champion: 'Argentina',
        championFlag: '🇦🇷',
        runnerUp: 'Netherlands',
        finalScore: '3 - 1 (AET)',
        teamsCount: 16,
        topScorer: 'Mario Kempes (6)',
        milestone: 'Argentina lifts its first World Cup trophy in Buenos Aires.',
        eraTag: 'Tactical Shift',
      },
      {
        year: 1982,
        host: 'Spain',
        champion: 'Italy',
        championFlag: '🇮🇹',
        runnerUp: 'Germany',
        finalScore: '3 - 1',
        teamsCount: 24,
        topScorer: 'Paolo Rossi (6)',
        milestone: 'Tournament expands from 16 to 24 teams; first penalty shootout (SF).',
        eraTag: '24-Team Expansion',
      },
      {
        year: 1986,
        host: 'Mexico',
        champion: 'Argentina',
        championFlag: '🇦🇷',
        runnerUp: 'Germany',
        finalScore: '3 - 2',
        teamsCount: 24,
        topScorer: 'Gary Lineker (6)',
        milestone: 'Diego Maradona delivers 5 goals & 5 assists in iconic Azteca triumph.',
        eraTag: '24-Team Expansion',
      },
      {
        year: 1990,
        host: 'Italy',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Argentina',
        finalScore: '1 - 0',
        teamsCount: 24,
        topScorer: 'Salvatore Schillaci (6)',
        milestone: 'First World Cup Final decided by a penalty kick; prompt back-pass rule.',
        eraTag: '24-Team Expansion',
      },
      {
        year: 1994,
        host: 'United States',
        champion: 'Brazil',
        championFlag: '🇧🇷',
        runnerUp: 'Italy',
        finalScore: '0 - 0 (3-2 P)',
        teamsCount: 24,
        topScorer: 'Stoichkov & Salenko (6)',
        milestone: 'First final settled on penalties; all-time attendance record (3.59M).',
        eraTag: 'Global Boom',
      },
      {
        year: 1998,
        host: 'France',
        champion: 'France',
        championFlag: '🇫🇷',
        runnerUp: 'Brazil',
        finalScore: '3 - 0',
        teamsCount: 32,
        topScorer: 'Davor Šuker (6)',
        milestone: 'Expanded to 32 teams; Zinedine Zidane scores twice in Paris final.',
        eraTag: '32-Team Era',
      },
      {
        year: 2002,
        host: 'South Korea & Japan',
        champion: 'Brazil',
        championFlag: '🇧🇷',
        runnerUp: 'Germany',
        finalScore: '2 - 0',
        teamsCount: 32,
        topScorer: 'Ronaldo (8)',
        milestone: 'First World Cup in Asia & first co-hosted; Brazil wins record 5th title.',
        eraTag: '32-Team Era',
      },
      {
        year: 2006,
        host: 'Germany',
        champion: 'Italy',
        championFlag: '🇮🇹',
        runnerUp: 'France',
        finalScore: '1 - 1 (5-3 P)',
        teamsCount: 32,
        topScorer: 'Miroslav Klose (5)',
        milestone: 'Italy claims fourth title in Berlin after dramatic penalty shootout.',
        eraTag: '32-Team Era',
      },
      {
        year: 2010,
        host: 'South Africa',
        champion: 'Spain',
        championFlag: '🇪🇸',
        runnerUp: 'Netherlands',
        finalScore: '1 - 0 (AET)',
        teamsCount: 32,
        topScorer: 'Müller, Villa, Sneijder, Forlán (5)',
        milestone: 'First tournament on African soil; Spain wins maiden World Cup via Iniesta.',
        eraTag: 'Tiki-Taka Era',
      },
      {
        year: 2014,
        host: 'Brazil',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Argentina',
        finalScore: '1 - 0 (AET)',
        teamsCount: 32,
        topScorer: 'James Rodríguez (6)',
        milestone: 'First European team to win in the Americas; goal-line tech debuts.',
        eraTag: 'Modern Tech Era',
      },
      {
        year: 2018,
        host: 'Russia',
        champion: 'France',
        championFlag: '🇫🇷',
        runnerUp: 'Croatia',
        finalScore: '4 - 2',
        teamsCount: 32,
        topScorer: 'Harry Kane (6)',
        milestone: 'VAR introduced at a World Cup; 19-year-old Mbappé scores in the final.',
        eraTag: 'Modern Tech Era',
      },
      {
        year: 2022,
        host: 'Qatar',
        champion: 'Argentina',
        championFlag: '🇦🇷',
        runnerUp: 'France',
        finalScore: '3 - 3 (4-2 P)',
        teamsCount: 32,
        topScorer: 'Kylian Mbappé (8)',
        milestone: 'First Middle East & winter World Cup; Messi wins Golden Ball in 3-3 final.',
        eraTag: 'Modern Tech Era',
      },
      {
        year: 2026,
        host: 'USA, Canada & Mexico',
        champion: 'Spain',
        championFlag: '🇪🇸',
        runnerUp: 'Argentina',
        finalScore: '1 - 0 (AET)',
        teamsCount: 48,
        topScorer: 'Lamine Yamal (6)',
        milestone: 'Expanded 48-team, 104-match tri-nation format across North America.',
        eraTag: '48-Team Era',
      },
    ],
  },
  'champions-league': {
    id: 'champions-league',
    name: 'UEFA Champions League',
    shortName: 'UCL Milestones (1956–2024)',
    foundedYear: 1956,
    originNote: 'Launched in 1955/56 as the 16-club European Champion Clubs Cup.',
    accentColor: '#38bdf8',
    editions: [
      {
        year: 1956,
        host: 'Paris',
        champion: 'Real Madrid',
        championFlag: '🇪🇸',
        runnerUp: 'Stade de Reims',
        finalScore: '4 - 3',
        teamsCount: 16,
        topScorer: 'Miloš Milutinović (8)',
        milestone: 'Inaugural European Cup final; Real Madrid wins 1st of 5 straight titles.',
        eraTag: 'European Cup Origin',
      },
      {
        year: 1960,
        host: 'Glasgow',
        champion: 'Real Madrid',
        championFlag: '🇪🇸',
        runnerUp: 'Eintracht Frankfurt',
        finalScore: '7 - 3',
        teamsCount: 27,
        topScorer: 'Ferenc Puskás (12)',
        milestone: 'Puskás scores 4 and Di Stéfano hits 3 at Hampden Park before 127k fans.',
        eraTag: 'Los Blancos Dynasty',
      },
      {
        year: 1967,
        host: 'Lisbon',
        champion: 'Celtic',
        championFlag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        runnerUp: 'Inter Milan',
        finalScore: '2 - 1',
        teamsCount: 33,
        topScorer: 'Jürgen Piepenburg & Paul Van Himst (6)',
        milestone: 'Lisbon Lions become first British club to lift the European Cup.',
        eraTag: 'Classic Era',
      },
      {
        year: 1971,
        host: 'London',
        champion: 'Ajax',
        championFlag: '🇳🇱',
        runnerUp: 'Panathinaikos',
        finalScore: '2 - 0',
        teamsCount: 33,
        topScorer: 'Antonis Antoniadis (10)',
        milestone: 'Johan Cruyff leads Ajax to the start of a three-peat Total Football run.',
        eraTag: 'Total Football',
      },
      {
        year: 1977,
        host: 'Rome',
        champion: 'Liverpool',
        championFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        runnerUp: 'Borussia M’gladbach',
        finalScore: '3 - 1',
        teamsCount: 32,
        topScorer: 'Franco Cucinotta & Gerd Müller (5)',
        milestone: 'First of Liverpool’s 6 European crowns under Bob Paisley.',
        eraTag: 'English Dominance',
      },
      {
        year: 1989,
        host: 'Barcelona',
        champion: 'AC Milan',
        championFlag: '🇮🇹',
        runnerUp: 'Steaua București',
        finalScore: '4 - 0',
        teamsCount: 31,
        topScorer: 'Marco van Basten (10)',
        milestone: 'Arrigo Sacchi’s Milan tactical pressing revolution conquers Europe.',
        eraTag: 'Tactical Revolution',
      },
      {
        year: 1993,
        host: 'Munich',
        champion: 'Marseille',
        championFlag: '🇫🇷',
        runnerUp: 'AC Milan',
        finalScore: '1 - 0',
        teamsCount: 36,
        topScorer: 'Romário (7)',
        milestone: 'First champion of the rebranded UEFA Champions League group-stage era.',
        eraTag: 'UCL Rebrand',
      },
      {
        year: 1999,
        host: 'Barcelona',
        champion: 'Man United',
        championFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        runnerUp: 'Bayern Munich',
        finalScore: '2 - 1',
        teamsCount: 24,
        topScorer: 'Andriy Shevchenko & Dwight Yorke (8)',
        milestone: 'Sheringham & Solskjær complete iconic stoppage-time treble comeback.',
        eraTag: 'UCL Expansion',
      },
      {
        year: 2005,
        host: 'Istanbul',
        champion: 'Liverpool',
        championFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        runnerUp: 'AC Milan',
        finalScore: '3 - 3 (3-2 P)',
        teamsCount: 32,
        topScorer: 'Ruud van Nistelrooy (8)',
        milestone: 'Miracle of Istanbul: Liverpool overturns a 3-0 halftime deficit.',
        eraTag: '32-Club Format',
      },
      {
        year: 2009,
        host: 'Rome',
        champion: 'Barcelona',
        championFlag: '🇪🇸',
        runnerUp: 'Man United',
        finalScore: '2 - 0',
        teamsCount: 32,
        topScorer: 'Lionel Messi (9)',
        milestone: 'Pep Guardiola’s Barcelona completes historic continental treble.',
        eraTag: '32-Club Format',
      },
      {
        year: 2014,
        host: 'Lisbon',
        champion: 'Real Madrid',
        championFlag: '🇪🇸',
        runnerUp: 'Atlético Madrid',
        finalScore: '4 - 1 (AET)',
        teamsCount: 32,
        topScorer: 'Cristiano Ronaldo (17)',
        milestone: 'La Décima; Ronaldo sets single-season 17-goal UCL scoring record.',
        eraTag: '32-Club Format',
      },
      {
        year: 2018,
        host: 'Kyiv',
        champion: 'Real Madrid',
        championFlag: '🇪🇸',
        runnerUp: 'Liverpool',
        finalScore: '3 - 1',
        teamsCount: 32,
        topScorer: 'Cristiano Ronaldo (15)',
        milestone: 'First club to win three consecutive Champions League titles.',
        eraTag: 'Modern Era',
      },
      {
        year: 2020,
        host: 'Lisbon',
        champion: 'Bayern Munich',
        championFlag: '🇩🇪',
        runnerUp: 'Paris Saint-Germain',
        finalScore: '1 - 0',
        teamsCount: 32,
        topScorer: 'Robert Lewandowski (15)',
        milestone: 'Bayern wins all 11 matches for the only 100%-win UCL campaign.',
        eraTag: 'Modern Era',
      },
      {
        year: 2023,
        host: 'Istanbul',
        champion: 'Man City',
        championFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        runnerUp: 'Inter Milan',
        finalScore: '1 - 0',
        teamsCount: 32,
        topScorer: 'Erling Haaland (12)',
        milestone: 'Rodri fires Manchester City to its maiden UCL title & treble.',
        eraTag: 'Modern Era',
      },
      {
        year: 2024,
        host: 'London',
        champion: 'Real Madrid',
        championFlag: '🇪🇸',
        runnerUp: 'Borussia Dortmund',
        finalScore: '2 - 0',
        teamsCount: 32,
        topScorer: 'Harry Kane & Kylian Mbappé (8)',
        milestone: 'Final edition before the 36-team Swiss-model League Phase expansion.',
        eraTag: 'Swiss Phase Transition',
      },
    ],
  },
  euro: {
    id: 'euro',
    name: 'UEFA European Championship',
    shortName: 'UEFA Euro (1960–2024)',
    foundedYear: 1960,
    originNote: 'Started in 1960 in France with a 4-team final tournament.',
    accentColor: '#ff3355',
    editions: [
      {
        year: 1960,
        host: 'France',
        champion: 'Soviet Union',
        championFlag: '🚩',
        runnerUp: 'Yugoslavia',
        finalScore: '2 - 1 (AET)',
        teamsCount: 4,
        topScorer: '5 players (2)',
        milestone: 'Inaugural European Nations Cup featuring 4 final-tournament teams.',
        eraTag: '4-Team Origin',
      },
      {
        year: 1964,
        host: 'Spain',
        champion: 'Spain',
        championFlag: '🇪🇸',
        runnerUp: 'Soviet Union',
        finalScore: '2 - 1',
        teamsCount: 4,
        topScorer: 'Pereda, Bene, Novák (2)',
        milestone: 'Spain wins its first major international title at Santiago Bernabéu.',
        eraTag: '4-Team Origin',
      },
      {
        year: 1968,
        host: 'Italy',
        champion: 'Italy',
        championFlag: '🇮🇹',
        runnerUp: 'Yugoslavia',
        finalScore: '2 - 0 (Replay)',
        teamsCount: 4,
        topScorer: 'Dragan Džajić (2)',
        milestone: 'Renamed UEFA European Championship; only final settled via replay.',
        eraTag: '4-Team Origin',
      },
      {
        year: 1972,
        host: 'Belgium',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Soviet Union',
        finalScore: '3 - 0',
        teamsCount: 4,
        topScorer: 'Gerd Müller (4)',
        milestone: 'Gerd Müller & Günter Netzer launch West Germany’s dominant decade.',
        eraTag: '4-Team Origin',
      },
      {
        year: 1976,
        host: 'Yugoslavia',
        champion: 'Czechoslovakia',
        championFlag: '🇨🇿',
        runnerUp: 'Germany',
        finalScore: '2 - 2 (5-3 P)',
        teamsCount: 4,
        topScorer: 'Dieter Müller (4)',
        milestone: 'Antonín Panenka invents the chipped "Panenka" shootout winner.',
        eraTag: '4-Team Origin',
      },
      {
        year: 1980,
        host: 'Italy',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Belgium',
        finalScore: '2 - 1',
        teamsCount: 8,
        topScorer: 'Klaus Allofs (3)',
        milestone: 'Final tournament expands from 4 to 8 nations with group play.',
        eraTag: '8-Team Era',
      },
      {
        year: 1984,
        host: 'France',
        champion: 'France',
        championFlag: '🇫🇷',
        runnerUp: 'Spain',
        finalScore: '2 - 0',
        teamsCount: 8,
        topScorer: 'Michel Platini (9)',
        milestone: 'Michel Platini sets single-tournament record with 9 goals in 5 games.',
        eraTag: '8-Team Era',
      },
      {
        year: 1988,
        host: 'West Germany',
        champion: 'Netherlands',
        championFlag: '🇳🇱',
        runnerUp: 'Soviet Union',
        finalScore: '2 - 0',
        teamsCount: 8,
        topScorer: 'Marco van Basten (5)',
        milestone: 'Marco van Basten hits unforgettable tight-angle volley in Munich.',
        eraTag: '8-Team Era',
      },
      {
        year: 1992,
        host: 'Sweden',
        champion: 'Denmark',
        championFlag: '🇩🇰',
        runnerUp: 'Germany',
        finalScore: '2 - 0',
        teamsCount: 8,
        topScorer: '4 players (3)',
        milestone: 'Denmark enters late and completes one of football’s greatest shocks.',
        eraTag: '8-Team Era',
      },
      {
        year: 1996,
        host: 'England',
        champion: 'Germany',
        championFlag: '🇩🇪',
        runnerUp: 'Czech Republic',
        finalScore: '2 - 1 (GG)',
        teamsCount: 16,
        topScorer: 'Alan Shearer (5)',
        milestone: 'Expanded to 16 teams; Bierhoff scores first major Golden Goal.',
        eraTag: '16-Team Era',
      },
      {
        year: 2000,
        host: 'Belgium & Netherlands',
        champion: 'France',
        championFlag: '🇫🇷',
        runnerUp: 'Italy',
        finalScore: '2 - 1 (GG)',
        teamsCount: 16,
        topScorer: 'Kluivert & Milošević (5)',
        milestone: 'First co-hosted Euro; Trezeguet golden goal gives France the double.',
        eraTag: '16-Team Era',
      },
      {
        year: 2004,
        host: 'Portugal',
        champion: 'Greece',
        championFlag: '🇬🇷',
        runnerUp: 'Portugal',
        finalScore: '1 - 0',
        teamsCount: 16,
        topScorer: 'Milan Baroš (5)',
        milestone: '150-to-1 outsiders Greece stun hosts Portugal in Lisbon.',
        eraTag: '16-Team Era',
      },
      {
        year: 2008,
        host: 'Austria & Switzerland',
        champion: 'Spain',
        championFlag: '🇪🇸',
        runnerUp: 'Germany',
        finalScore: '1 - 0',
        teamsCount: 16,
        topScorer: 'David Villa (4)',
        milestone: 'Fernando Torres sparks Spain’s historic 2008–2012 golden dynasty.',
        eraTag: '16-Team Era',
      },
      {
        year: 2012,
        host: 'Poland & Ukraine',
        champion: 'Spain',
        championFlag: '🇪🇸',
        runnerUp: 'Italy',
        finalScore: '4 - 0',
        teamsCount: 16,
        topScorer: '6 players (3)',
        milestone: 'Spain becomes the only team to defend a UEFA Euro title.',
        eraTag: '16-Team Era',
      },
      {
        year: 2016,
        host: 'France',
        champion: 'Portugal',
        championFlag: '🇵🇹',
        runnerUp: 'France',
        finalScore: '1 - 0 (AET)',
        teamsCount: 24,
        topScorer: 'Antoine Griezmann (6)',
        milestone: 'Expanded to 24 teams; Portugal wins first major international trophy.',
        eraTag: '24-Team Era',
      },
      {
        year: 2020,
        host: 'Pan-European (11 Cities)',
        champion: 'Italy',
        championFlag: '🇮🇹',
        runnerUp: 'England',
        finalScore: '1 - 1 (3-2 P)',
        teamsCount: 24,
        topScorer: 'Ronaldo & Schick (5)',
        milestone: '60th-anniversary pan-continental edition; Italy wins at Wembley.',
        eraTag: '24-Team Era',
      },
      {
        year: 2024,
        host: 'Germany',
        champion: 'Spain',
        championFlag: '🇪🇸',
        runnerUp: 'England',
        finalScore: '2 - 1',
        teamsCount: 24,
        topScorer: '6 players (3)',
        milestone: 'Spain wins record 4th Euro trophy with 7 consecutive victories.',
        eraTag: '24-Team Era',
      },
    ],
  },
};

export const TournamentHistoryD3: React.FC = () => {
  const [activeCompId, setActiveCompId] = useState<HistoryCompetitionId>('world-cup');
  const [selectedYear, setSelectedYear] = useState<number>(1930);
  const [filterChampion, setFilterChampion] = useState<string | null>(null);

  const timelineWrapperRef = useRef<HTMLDivElement>(null);
  const timelineSvgRef = useRef<SVGSVGElement>(null);
  const winnersWrapperRef = useRef<HTMLDivElement>(null);
  const winnersSvgRef = useRef<SVGSVGElement>(null);

  const [timelineWidth, setTimelineWidth] = useState<number>(760);
  const [winnersWidth, setWinnersWidth] = useState<number>(420);

  const competition = COMPETITIONS[activeCompId];

  const selectedEdition = useMemo(() => {
    return (
      competition.editions.find((e) => e.year === selectedYear) ??
      competition.editions[0]
    );
  }, [competition.editions, selectedYear]);

  // Aggregate winners dynamically using d3.rollups
  const winnerTotals = useMemo(() => {
    const grouped = d3.rollups(
      competition.editions,
      (v) => ({
        titles: v.length,
        years: v.map((d) => d.year),
        flag: v[0].championFlag,
      }),
      (d) => d.champion
    );
    return grouped
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.titles - a.titles || a.years[0] - b.years[0]);
  }, [competition.editions]);

  // Measure responsive containers for D3 SVGs
  useEffect(() => {
    const updateSizes = () => {
      if (timelineWrapperRef.current) {
        setTimelineWidth(Math.max(320, timelineWrapperRef.current.clientWidth));
      }
      if (winnersWrapperRef.current) {
        setWinnersWidth(Math.max(280, winnersWrapperRef.current.clientWidth));
      }
    };
    updateSizes();
    const observer = new ResizeObserver(updateSizes);
    if (timelineWrapperRef.current) observer.observe(timelineWrapperRef.current);
    if (winnersWrapperRef.current) observer.observe(winnersWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. Render D3 Historical Timeline & Milestone Expansion Chart
  useEffect(() => {
    const svgEl = timelineSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const height = 290;
    const margin = { top: 26, right: 24, bottom: 42, left: 46 };
    const innerW = Math.max(180, timelineWidth - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${timelineWidth} ${height}`);

    const defs = svg.append('defs');
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', `hist-area-${activeCompId}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', competition.accentColor)
      .attr('stop-opacity', 0.34);
    areaGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', competition.accentColor)
      .attr('stop-opacity', 0.02);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const years = competition.editions.map((d) => d.year);
    const maxTeams = d3.max(competition.editions, (d) => d.teamsCount) ?? 48;

    const xScale = d3
      .scaleLinear()
      .domain([d3.min(years) ?? 1930, d3.max(years) ?? 2026])
      .range([0, innerW]);

    const yScale = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxTeams * 1.15)])
      .range([innerH, 0]);

    // Subtle horizontal gridlines
    const yTicks = yScale.ticks(5);
    g.append('g')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1f2638')
      .attr('stroke-dasharray', '3 4');

    // Axes
    const xAxis = d3
      .axisBottom<number>(xScale)
      .ticks(timelineWidth < 520 ? 5 : 10)
      .tickFormat((d) => String(d));
    const yAxis = d3.axisLeft<number>(yScale).ticks(5);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);
    xAxisG.selectAll('path, line').attr('stroke', '#2c354c');
    xAxisG
      .selectAll('text')
      .attr('fill', '#8b94a5')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.selectAll('path, line').attr('stroke', '#2c354c');
    yAxisG
      .selectAll('text')
      .attr('fill', '#8b94a5')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Y-axis label
    g.append('text')
      .attr('x', 4)
      .attr('y', -10)
      .attr('fill', '#8b94a5')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .text('TEAMS IN TOURNAMENT');

    // Area + Line curve showing expansion from tournament origin
    const areaGen = d3
      .area<TournamentEdition>()
      .x((d) => xScale(d.year))
      .y0(innerH)
      .y1((d) => yScale(d.teamsCount))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<TournamentEdition>()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.teamsCount))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(competition.editions)
      .attr('fill', `url(#hist-area-${activeCompId})`)
      .attr('d', areaGen);

    g.append('path')
      .datum(competition.editions)
      .attr('fill', 'none')
      .attr('stroke', competition.accentColor)
      .attr('stroke-width', 2.4)
      .attr('d', lineGen);

    // Interactive milestone nodes
    const nodes = g
      .selectAll<SVGGElement, TournamentEdition>('g.milestone-node')
      .data(competition.editions, (d) => String(d.year))
      .join('g')
      .attr('class', 'milestone-node')
      .attr('transform', (d) => `translate(${xScale(d.year)},${yScale(d.teamsCount)})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        setSelectedYear(d.year);
      })
      .on('mouseenter', (_event, d) => {
        setSelectedYear(d.year);
      });

    // Selected pulse halo
    nodes
      .filter((d) => d.year === selectedEdition.year)
      .append('circle')
      .attr('r', 12)
      .attr('fill', 'none')
      .attr('stroke', '#ff3355')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.85);

    nodes
      .append('circle')
      .attr('r', (d) => {
        if (d.year === selectedEdition.year) return 7.5;
        if (filterChampion && d.champion === filterChampion) return 6.5;
        return 4.8;
      })
      .attr('fill', (d) => {
        if (d.year === selectedEdition.year) return '#ff3355';
        if (filterChampion && d.champion === filterChampion) return '#facc15';
        return competition.accentColor;
      })
      .attr('stroke', '#0d1018')
      .attr('stroke-width', 1.8)
      .attr('opacity', (d) =>
        filterChampion && d.champion !== filterChampion && d.year !== selectedEdition.year
          ? 0.28
          : 1
      );

    // Flag labels above selected or filtered championship nodes
    nodes
      .filter(
        (d) =>
          d.year === selectedEdition.year ||
          (filterChampion !== null && d.champion === filterChampion)
      )
      .append('text')
      .attr('y', -13)
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px')
      .text((d) => d.championFlag);
  }, [
    activeCompId,
    competition.accentColor,
    competition.editions,
    filterChampion,
    selectedEdition.year,
    timelineWidth,
  ]);

  // 2. Render D3 All-Time Winners Bar Chart
  useEffect(() => {
    const svgEl = winnersSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const visibleWinners = winnerTotals.slice(0, 9);
    const rowH = 30;
    const margin = { top: 10, right: 44, bottom: 26, left: 118 };
    const height = margin.top + margin.bottom + visibleWinners.length * rowH;
    const innerW = Math.max(120, winnersWidth - margin.left - margin.right);
    const innerH = visibleWinners.length * rowH;

    svg.attr('viewBox', `0 0 ${winnersWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxTitles = d3.max(visibleWinners, (d) => d.titles) ?? 5;
    const xScale = d3.scaleLinear().domain([0, maxTitles]).range([0, innerW]);
    const yScale = d3
      .scaleBand<string>()
      .domain(visibleWinners.map((d) => d.name))
      .range([0, innerH])
      .padding(0.28);

    const xAxis = d3
      .axisBottom<number>(xScale)
      .ticks(Math.min(maxTitles, 5))
      .tickFormat((d) => (Number.isInteger(d) ? String(d) : ''));

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);
    xAxisG.selectAll('path, line').attr('stroke', '#2c354c');
    xAxisG
      .selectAll('text')
      .attr('fill', '#8b94a5')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    const rows = g
      .selectAll<SVGGElement, (typeof visibleWinners)[number]>('g.winner-row')
      .data(visibleWinners, (d) => d.name)
      .join('g')
      .attr('class', 'winner-row')
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        setFilterChampion((prev) => (prev === d.name ? null : d.name));
        setSelectedYear(d.years[0]);
      });

    // Background track bar
    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.name) ?? 0)
      .attr('width', innerW)
      .attr('height', yScale.bandwidth())
      .attr('rx', 5)
      .attr('fill', '#161b29');

    // Animated D3 data bar (CSS transition + rAF avoids d3-transition prototype tree-shaking)
    const bars = rows
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.name) ?? 0)
      .attr('height', yScale.bandwidth())
      .attr('rx', 5)
      .attr('fill', (d) =>
        filterChampion === d.name ? '#ff3355' : competition.accentColor
      )
      .attr('opacity', (d) =>
        filterChampion && filterChampion !== d.name ? 0.35 : 0.9
      )
      .attr('width', 0)
      .style('transition', 'width 420ms cubic-bezier(0.22, 1, 0.36, 1)');

    const animFrame = window.requestAnimationFrame(() => {
      bars.attr('width', (d) => Math.max(8, xScale(d.titles)));
    });

    // Left Label (Flag + Champion Name)
    rows
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => (yScale(d.name) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', (d) => (filterChampion === d.name ? '#ff5c77' : '#e2e8f0'))
      .attr('font-size', '11px')
      .attr('font-weight', (d) => (filterChampion === d.name ? '800' : '600'))
      .text((d) => `${d.flag} ${d.name}`);

    // Right Trophy Count Label
    rows
      .append('text')
      .attr('x', (d) => Math.max(8, xScale(d.titles)) + 8)
      .attr('y', (d) => (yScale(d.name) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('fill', '#f8fafc')
      .attr('font-size', '11px')
      .attr('font-weight', '800')
      .attr('font-family', 'monospace')
      .text((d) => `${d.titles}x`);

    return () => {
      window.cancelAnimationFrame(animFrame);
    };
  }, [competition.accentColor, filterChampion, winnerTotals, winnersWidth]);

  const handleCompetitionSwitch = (id: HistoryCompetitionId) => {
    setActiveCompId(id);
    setFilterChampion(null);
    setSelectedYear(COMPETITIONS[id].editions[0].year);
  };

  return (
    <section
      id="tournament-history-section"
      className="rounded-3xl border border-[#242b3e] border-t-2 border-t-[#ff3355]/60 bg-gradient-to-br from-[#121622] via-[#0f131d] to-[#0b0e15] p-5 sm:p-8 shadow-2xl space-y-6"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff3355]/35 bg-[#ff3355]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#ff5c77] font-mono">
            <History className="h-3.5 w-3.5" />
            <span>D3 HISTORICAL ARCHIVE • ORIGIN TO PRESENT</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            TOURNAMENT <span className="text-[#00ff88]">HISTORY</span> &amp; MILESTONES
          </h2>
          <p className="text-xs sm:text-sm text-[#8b94a5] max-w-2xl">
            {competition.originNote} Explore every champion and expansion milestone using interactive D3 timelines.
          </p>
        </div>

        {/* Competition Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#232a3e] bg-[#0b0e16] p-1.5">
          {(Object.values(COMPETITIONS) as CompetitionDataset[]).map((comp) => {
            const isActive = comp.id === activeCompId;
            return (
              <button
                key={comp.id}
                onClick={() => handleCompetitionSwitch(comp.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#00ff88] text-black shadow-md'
                    : 'text-[#9da7b8] hover:text-white hover:bg-[#171d2c]'
                }`}
              >
                {comp.shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main D3 Grid: Left Timeline + Right All-Time Winners */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* D3 Timeline & Expansion Milestones */}
        <div className="xl:col-span-8 rounded-2xl border border-[#21283b] bg-[#0c0f17] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#00ff88]" />
                <span>Historical Expansion &amp; Champion Timeline ({competition.foundedYear}–Present)</span>
              </h3>
              <p className="text-[11px] text-[#8b94a5]">
                Hover or click any milestone node along the D3 curve to inspect that edition
              </p>
            </div>

            {filterChampion && (
              <button
                onClick={() => setFilterChampion(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff3355]/40 bg-[#ff3355]/15 px-2.5 py-1 text-[11px] font-bold text-[#ff5c77] hover:bg-[#ff3355] hover:text-white transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear Filter ({filterChampion})</span>
              </button>
            )}
          </div>

          <div ref={timelineWrapperRef} className="w-full overflow-hidden">
            <svg
              ref={timelineSvgRef}
              className="w-full h-auto block select-none"
              role="img"
              aria-label={`${competition.name} D3 Historical Timeline`}
            />
          </div>

          {/* Interactive Selected Milestone Spotlight Card */}
          <div className="rounded-2xl border border-[#242c42] border-l-4 border-l-[#ff3355] bg-[#121725] p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-4 flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1a2134] border border-[#2e3854] text-3xl">
                {selectedEdition.championFlag}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-[#00ff88] tabular-nums">
                    {selectedEdition.year}
                  </span>
                  <span className="rounded bg-[#ff3355]/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#ff5c77]">
                    {selectedEdition.eraTag}
                  </span>
                </div>
                <div className="text-base font-black text-white">
                  {selectedEdition.champion}
                </div>
                <div className="text-[11px] text-[#8b94a5] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#ff3355]" />
                  <span>Host: {selectedEdition.host}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#38bdf8] flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>Tournament Milestone</span>
              </div>
              <p className="text-xs text-[#dbe3f0] leading-relaxed">
                {selectedEdition.milestone}
              </p>
            </div>

            <div className="md:col-span-3 flex md:flex-col justify-between gap-2 md:text-right border-t md:border-t-0 md:border-l border-[#232b40] pt-3 md:pt-0 md:pl-4">
              <div>
                <div className="text-[10px] font-bold uppercase text-[#8b94a5]">
                  Final vs {selectedEdition.runnerUp}
                </div>
                <div className="font-mono text-sm font-black text-white tabular-nums">
                  {selectedEdition.finalScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-[#8b94a5]">
                  Top Scorer
                </div>
                <div className="text-xs font-bold text-[#00ff88]">
                  {selectedEdition.topScorer}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* D3 All-Time Champions Bar Chart */}
        <div className="xl:col-span-4 rounded-2xl border border-[#21283b] bg-[#0c0f17] p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#facc15]" />
                <span>All-Time Winners</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8b94a5]">
                <Filter className="h-3 w-3" /> Click bar to filter
              </span>
            </div>
            <p className="text-[11px] text-[#8b94a5]">
              D3 aggregated title leaderboard across {competition.editions.length} recorded milestones
            </p>
          </div>

          <div ref={winnersWrapperRef} className="w-full overflow-hidden flex-1">
            <svg
              ref={winnersSvgRef}
              className="w-full h-auto block select-none"
              role="img"
              aria-label={`${competition.name} All-Time Winners Bar Chart`}
            />
          </div>

          {/* Quick Year Strip & Scale Summary */}
          <div className="border-t border-[#1e2436] pt-3 flex items-center justify-between text-[11px] text-[#8b94a5]">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#00ff88]" />
              <span>Scale: {selectedEdition.teamsCount} Teams</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Award className="h-3.5 w-3.5 text-[#ff3355]" />
              <span>{winnerTotals.length} Champions</span>
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Historical Milestone Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {competition.editions.map((ed) => {
          const isSelected = ed.year === selectedEdition.year;
          const isFilteredOut =
            filterChampion !== null && ed.champion !== filterChampion;
          return (
            <button
              key={ed.year}
              onClick={() => setSelectedYear(ed.year)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                isSelected
                  ? 'border-[#ff3355] bg-[#ff3355]/20 text-white shadow-sm'
                  : isFilteredOut
                  ? 'border-[#1d2231] bg-[#10131c] text-[#556078] opacity-55'
                  : 'border-[#232a3e] bg-[#121622] text-[#b4bfd2] hover:border-[#00ff88]/50 hover:text-white'
              }`}
            >
              <span>{ed.championFlag}</span>
              <span className="font-mono tabular-nums">{ed.year}</span>
              <span className="text-[10px] text-[#8b94a5]">{ed.champion}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
