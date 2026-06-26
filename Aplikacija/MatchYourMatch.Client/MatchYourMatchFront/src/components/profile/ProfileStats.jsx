import { Calendar, Heart, MessageCircle, Star } from 'lucide-react';

export default function ProfileStats({
  matches,
  eventsJoined,
  profileScore,
  responseRate,
  ratingsCount = 0,
  labels,
}) {
  const cards = [
    { icon: Heart, label: labels.matches, value: number(matches) },
    { icon: Calendar, label: labels.eventsJoined, value: number(eventsJoined) },
    {
      icon: Star,
      label: labels.profileScore,
      value: ratingsCount > 0 ? percent(profileScore) : 'Not rated',
    },
    {
      icon: MessageCircle,
      label: labels.responseRate,
      value: percent(responseRate),
    },
  ];
  return (
    <div className='profile__stat-grid'>
      {cards.map(({ icon: Icon, label, value }) => (
        <div key={label} className='profile__stat-card app-tilt-hover'>
          <Icon size={18} />
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
const number = (value) => (typeof value === 'number' ? String(value) : '0');
const percent = (value) =>
  typeof value === 'number' ? `${value}%` : 'Not rated';
