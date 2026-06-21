const QUICK_MATCH_EXTRAS = [
  { mood: 'Probably listening to Arctic Monkeys right now', musicTag: 'Indie Rock', energyTag: 'High Energy', activityTag: 'Night Owl' },
  { mood: 'Coffee first. Emotions second.', musicTag: 'Lo-Fi Jazz', energyTag: 'Chill Vibes', activityTag: 'Morning Person' },
  { mood: 'Always down for midnight drives', musicTag: 'Alt Pop', energyTag: 'Adventurous', activityTag: 'Road Tripper' },
  { mood: 'Looking for someone equally chaotic.', musicTag: 'Electronic', energyTag: 'High Energy', activityTag: 'Gym & Tech' },
  { mood: 'Can talk about design for hours', musicTag: 'Soul & R&B', energyTag: 'Warm Energy', activityTag: 'Gallery Nights' },
  { mood: 'Overthinks text messages (relatably)', musicTag: 'Acoustic', energyTag: 'Soft Energy', activityTag: 'Book Nook' },
  { mood: 'Theater kid energy, always', musicTag: 'Classic Jazz', energyTag: 'Expressive', activityTag: 'Live Shows' },
  { mood: 'Spontaneous plans > calendar invites', musicTag: 'House', energyTag: 'Social Spark', activityTag: 'Nightlife' },
];

export const matches = [
  { id: 1, name: 'Alex Rivera', age: 28, location: 'Brooklyn, NY', compatibility: 94, interests: ['Music', 'Travel', 'Design'], initials: 'AR', ...QUICK_MATCH_EXTRAS[0] },
  { id: 2, name: 'Sam Chen', age: 26, location: 'Manhattan, NY', compatibility: 91, interests: ['Coffee', 'Art', 'Film'], initials: 'SC', ...QUICK_MATCH_EXTRAS[1] },
  { id: 3, name: 'Morgan Blake', age: 29, location: 'Queens, NY', compatibility: 88, interests: ['Hiking', 'Photography', 'Food'], initials: 'MB', ...QUICK_MATCH_EXTRAS[2] },
  { id: 4, name: 'Riley Park', age: 27, location: 'Jersey City, NJ', compatibility: 86, interests: ['Sports', 'Tech', 'Music'], initials: 'RP', ...QUICK_MATCH_EXTRAS[3] },
  { id: 5, name: 'Jordan Lee', age: 30, location: 'Williamsburg, NY', compatibility: 92, interests: ['Design', 'Travel', 'Wine'], initials: 'JL', ...QUICK_MATCH_EXTRAS[4] },
  { id: 6, name: 'Casey Morgan', age: 25, location: 'Astoria, NY', compatibility: 85, interests: ['Books', 'Yoga', 'Cooking'], initials: 'CM', ...QUICK_MATCH_EXTRAS[5] },
  { id: 7, name: 'Taylor Brooks', age: 31, location: 'Hoboken, NJ', compatibility: 89, interests: ['Theater', 'Jazz', 'Dance'], initials: 'TB', ...QUICK_MATCH_EXTRAS[6] },
  { id: 8, name: 'Jamie Fox', age: 28, location: 'Lower East Side, NY', compatibility: 87, interests: ['Fashion', 'Art', 'Nightlife'], initials: 'JF', ...QUICK_MATCH_EXTRAS[7] },
];

export const CURRENT_USER = {
  name: 'Jordan Dale',
  initials: 'JD',
  username: 'jordandale',
  location: 'Brooklyn, NY',
  completion: 78,
  personalityType: 'Creative Energy',
};

export const suggestedConnections = matches.map((m, i) => ({
  ...m,
  bio: [
    'Lives for live sets and spontaneous city adventures.',
    'Quiet mornings, bold evenings, always curious.',
    'Creative soul with a passion for meaningful dialogue.',
    'Tech-minded but deeply human at heart.',
    'Design-led thinker who values intentional connection.',
    'Bookworm energy with a warm, grounded presence.',
    'Theater nights and jazz bars — always exploring.',
    'Fashion-forward, art-driven, socially magnetic.',
  ][i],
  online: i % 3 !== 2,
  mutualInterests: m.interests.slice(0, 2),
}));
