# Footballers Insight

A comprehensive Next.js 15 application for football analytics and insights, built with TypeScript, Tailwind CSS, and Neon PostgreSQL database.

## 🏗️ Architecture Overview

This application follows a modern full-stack architecture with clear separation of concerns:

- **Frontend**: Next.js 15 App Router with React 19, TypeScript, and Tailwind CSS
- **Backend**: Next.js API Routes for server-side logic
- **Database**: Neon PostgreSQL with dedicated database folder for connections and migrations
- **Styling**: Tailwind CSS with custom color scheme supporting dark/light modes

## 📁 Project Structure

```
Footballers-Insight/
├── app/                     # Next.js App Router
│   ├── (public)/            # Marketing + auth routes with navbar/footer layout
│   │   ├── (static)/        # Static marketing pages (home, platform, contact, about)
│   │   ├── login/           # Login (front-end only demo)
│   │   └── signup/          # Signup (front-end only demo)
│   ├── dashboard/           # Protected dashboard (no navbar/footer)
│   ├── api/                 # API routes (placeholder)
│   ├── globals.css          # Global styles + Tailwind layer imports
│   └── layout.tsx           # Root layout (shell only)
├── components/              # Shared components imported via "@/components/*"
│   ├── layout/              # Navbar, Footer, layout primitives
│   ├── ui/                  # Base UI (Button, SectionHeader)
│   └── features/            # Feature blocks (HeroInsightPanel, SpotlightTabs, etc.)
├── types/                   # Global type declarations (e.g., globals.css.d.ts)
├── db/                      # Database setup and migrations (Neon)
├── public/                  # Static assets
├── scripts/                 # Project maintenance scripts
├── .env.local               # Environment variables (create locally)
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TS config with `@/*` alias to repo root
└── README.md
```

## 🗄️ Database Setup (Neon PostgreSQL)

The application uses **Neon** (serverless PostgreSQL) for data persistence. All database-related code is organized in the `database/` folder.

### Database Folder Structure

- **`database/connection.ts`**: Establishes connection to Neon PostgreSQL database
- **`database/schema.ts`**: Defines database schemas using your preferred ORM (e.g., Drizzle, Prisma)
- **`database/migrations/`**: Contains all database migration files for version control

### Connection Example

The database connection will be configured to use the Neon connection string from environment variables. The connection file handles:

- Connection pooling
- Error handling
- Type-safe queries
- Migration management

## 🔌 API Routes

API routes are located in `app/api/` following Next.js App Router conventions:

```
app/api/
├── route.ts              # Example API route
└── [resource]/           # Resource-specific routes
    └── route.ts
```

Each API route:

- Uses `export const dynamic = "force-dynamic"` after imports (as per project rules)
- Handles database operations through the database folder
- Returns JSON responses
- Implements proper error handling

## 🎨 Frontend Components Library

Reusable components live at `components/` (imported with the `@/` alias):

```
components/
├── layout/               # Layout primitives (Navbar, Footer)
├── ui/                   # Base UI components (buttons, section headers)
└── features/             # Feature-specific blocks used across static pages
```

## 🔐 Auth (front-end demo)

- Login and signup live at `/login` and `/signup`; they set a simple `fi_session` cookie on the client only.
- `/dashboard` is protected by `middleware.ts`, which redirects unauthenticated users to `/login` and signed-in users away from auth pages.
- This is a front-end-only simulation; replace the cookie logic with real auth when a backend is ready.

Components follow these conventions:

- TypeScript with proper type definitions
- Tailwind CSS for styling
- Support for dark/light mode via color scheme
- Reusable and composable design

## 🛠️ Feature Development Guidelines

When creating new features, follow this organizational pattern to maintain clean, modular code:

### Feature Isolation Principle

**Each feature should be self-contained and organized in its own folder structure:**

1. **API Features**: Create a dedicated folder inside `app/api/` for each feature

   ```
   app/api/
   ├── players/              # Players feature API routes
   │   └── route.ts
   ├── matches/             # Matches feature API routes
   │   └── route.ts
   └── analytics/           # Analytics feature API routes
       └── route.ts
   ```

2. **Component Features**: Create a dedicated folder inside `app/components/` for feature-specific components

   ```
   app/components/
   ├── players/             # Players feature components
   │   ├── PlayerCard.tsx
   │   └── PlayerList.tsx
   ├── matches/             # Matches feature components
   │   ├── MatchCard.tsx
   │   └── MatchSchedule.tsx
   └── analytics/           # Analytics feature components
       └── StatsDashboard.tsx
   ```

3. **Library/Utility Features**: Create a dedicated file or folder inside `lib/` (if needed) for feature-specific utilities
   ```
   lib/
   ├── players.ts           # Players feature utilities
   ├── matches.ts           # Matches feature utilities
   └── analytics.ts         # Analytics feature utilities
   ```

### Important Rules

✅ **DO:**

- Create new folders/files for each feature
- Keep all feature-related code in its dedicated folder
- Import features into files that need them (don't modify existing files)
- Maintain clear separation between features

❌ **DON'T:**

- Add feature code to existing files that aren't part of that feature
- Mix multiple features in the same file
- Modify shared/core files unless absolutely necessary
- Create circular dependencies between features

### Example: Adding a "Players" Feature

**Step 1**: Create API route folder

```
app/api/players/route.ts
```

**Step 2**: Create component folder

```
app/components/players/
├── PlayerCard.tsx
└── PlayerList.tsx
```

**Step 3**: Create utility file (if needed)

```
lib/players.ts
```

**Step 4**: Import and use in pages

```typescript
// app/page.tsx or app/players/page.tsx
import { PlayerList } from "@/app/components/players/PlayerList";
import { fetchPlayers } from "@/lib/players";
```

This approach ensures:

- **Modularity**: Each feature is independent and can be developed/tested separately
- **Maintainability**: Easy to locate and modify feature-specific code
- **Scalability**: New features don't clutter existing files
- **Organization**: Clear structure for AI assistants and developers to understand

## 🎨 Color Scheme

The application uses a carefully designed color palette that supports both light and dark modes:

### Main Colors

- **White** (`#ffffff`): Primary background for light mode
- **Black** (`#000000` / `#0a0a0a`): Primary background for dark mode

### Accent Colors (Gold Theme)

- **Light Mode Gold**: `#e3ca76`
  - HEX: `#e3ca76`
  - RGB: `rgba(227, 202, 118)`
  - HSL: `46, 66, 68`
- **Dark Mode Gold**: `#a78443`
  - HEX: `#a78443`
  - RGB: `rgba(167, 132, 67)`
  - HSL: `39, 43, 46`

### Color Usage Guidelines

- Use white/black for primary backgrounds and text
- Use light mode gold (`#e3ca76`) for accents, highlights, and interactive elements in light mode
- Use dark mode gold (`#a78443`) for accents, highlights, and interactive elements in dark mode
- Ensure sufficient contrast ratios for accessibility

## 🔐 Environment Variables (.env.local)

Create a `.env.local` file in the root directory with the following variables:

```env
# Neon PostgreSQL Database
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: API Keys (if needed)
# NEXT_PUBLIC_API_KEY=your_api_key_here
```

### Environment Variables Explained

- **`DATABASE_URL`**: Full connection string for Neon PostgreSQL database. Includes username, password, hostname, database name, and SSL mode.
- **`NEXT_PUBLIC_APP_URL`**: Base URL of the application (used for API calls, redirects, etc.)
- **`NEXT_PUBLIC_*`**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Use these for client-side configuration.
- **Non-prefixed variables**: Server-side only variables (not exposed to browser)

**⚠️ Important**: Never commit `.env.local` to version control. It's already included in `.gitignore`.

## 📦 Package Management

### Dependencies

**Production:**

- `next`: Next.js 15 framework
- `react`: React 19 library
- `react-dom`: React DOM for rendering

**Development:**

- `typescript`: TypeScript compiler
- `@types/node`, `@types/react`, `@types/react-dom`: TypeScript type definitions
- `tailwindcss`: Utility-first CSS framework
- `@tailwindcss/postcss`: PostCSS plugin for Tailwind
- `eslint`: Code linting
- `eslint-config-next`: Next.js ESLint configuration

### Adding New Packages

When adding new packages, follow these guidelines:

1. **Database/ORM**: Add to `dependencies` (e.g., `drizzle-orm`, `@neondatabase/serverless`)
2. **UI Libraries**: Add to `dependencies` (e.g., `lucide-react` for icons)
3. **Development Tools**: Add to `devDependencies` (e.g., `@types/package-name`)

Example:

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit @types/node
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Neon PostgreSQL database account
- npm, yarn, pnpm, or bun package manager

### Installation

1. Clone the repository (if applicable)
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local` file with your Neon database connection string:

   ```env
   DATABASE_URL=your_neon_connection_string
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Set up the database:

   ```bash
   # Run migrations (once database folder is set up)
   npm run db:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📝 Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build production bundle
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## 🤖 AI-Friendly Documentation

This README is structured to help AI assistants understand:

1. **Project Structure**: Clear folder organization and purpose
2. **Database Setup**: Neon PostgreSQL configuration and migration strategy
3. **API Patterns**: Next.js API route conventions
4. **Component Library**: Frontend component organization
5. **Color Scheme**: Exact color values and usage guidelines
6. **Environment Variables**: Required configuration and security notes
7. **Package Management**: Dependency categories and installation patterns

When working with AI assistants, reference this README for:

- Understanding the project architecture
- Locating files and folders
- Following coding conventions
- Implementing new features
- Setting up the development environment

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## 🚢 Deploy on Vercel

The easiest way to deploy this Next.js app is using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme):

1. Push your code to GitHub
2. Import your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
