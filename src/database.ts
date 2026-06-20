import * as fs from 'fs';
import * as path from 'path';

export interface UserProfile {
  discordId: string;
  discordTag: string;
  riotName: string;
  riotTag: string;
  tier: string;
  peakTier: string;  // Peak tier achieved
  rating: number;
  lastUpdated: string;
}

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'db.json');


// Read current data from JSON database
function readDb(): Record<string, UserProfile> {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return {};
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Failed to read database file:', error);
    return {};
  }
}

// Write data to JSON database
function writeDb(data: Record<string, UserProfile>): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write database file:', error);
  }
}

// Save or update a user profile
export function saveUser(profile: UserProfile): void {
  const db = readDb();
  db[profile.discordId] = profile;
  writeDb(db);
}

// Retrieve a user profile by Discord ID
export function getUser(discordId: string): UserProfile | null {
  const db = readDb();
  return db[discordId] || null;
}

// Get all registered users as an array
export function getAllUsers(): UserProfile[] {
  const db = readDb();
  return Object.values(db);
}

// Delete a user profile from the database
export function deleteUser(discordId: string): boolean {
  const db = readDb();
  if (db[discordId]) {
    delete db[discordId];
    writeDb(db);
    return true;
  }
  return false;
}
