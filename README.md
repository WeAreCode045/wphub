# WPHub

Your centralized hub to manage all your WordPress sites, themes, and plugins.

## Features

- 🔐 **User Authentication** - Secure login and signup with Supabase Auth
- 🌐 **Site Management** - Add, view, and delete WordPress sites
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- ⚡ **Fast & Modern** - Built with React and Vite for optimal performance
- 🎨 **Beautiful UI** - Clean, gradient-based design with smooth animations

## Tech Stack

- **Frontend**: React 19.2 + Vite
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Routing**: React Router DOM
- **Styling**: CSS3 with modern features

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/WeAreCode045/wphub.git
cd wphub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon/public key
4. Create the database tables (see Database Schema section below)

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Database Schema

Create the following table in your Supabase SQL Editor:

```sql
-- Create sites table
CREATE TABLE sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own sites" ON sites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sites" ON sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sites" ON sites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sites" ON sites
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
wphub/
├── src/
│   ├── components/       # Reusable components
│   │   ├── Login.jsx
│   │   ├── SignUp.jsx
│   │   └── Auth.css
│   ├── contexts/         # React contexts
│   │   └── AuthContext.jsx
│   ├── lib/             # Utilities and configurations
│   │   └── supabase.js
│   ├── pages/           # Page components
│   │   ├── Home.jsx
│   │   ├── Home.css
│   │   ├── Dashboard.jsx
│   │   └── Dashboard.css
│   ├── App.jsx          # Main app component with routing
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles
├── .env.example         # Environment variables template
├── package.json
└── README.md
```

## Usage

1. **Sign Up**: Create a new account with your email and password
2. **Login**: Sign in with your credentials
3. **Add Sites**: Click "Add Site" to add your WordPress sites
4. **Manage Sites**: View, edit, or delete your sites from the dashboard
5. **Sign Out**: Click "Sign Out" when you're done

## Future Enhancements

- Theme management
- Plugin tracking
- Update notifications
- Site health monitoring
- Bulk operations
- Export/import functionality

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.
