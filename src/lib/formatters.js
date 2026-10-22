export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

export function formatDateTime(dateTimeString) {
  if (!dateTimeString) return '-';
  const date = new Date(dateTimeString);
  if (Number.isNaN(date.getTime())) return dateTimeString;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function getDueDateStatus(dueDateStr, isPaid = false) {
  if (!dueDateStr || isPaid) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dueDateStr.split('-');
  const due = new Date(parts[0], parts[1] - 1, parts[2]);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'overdue',
      text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`,
      color: 'text-red-700 bg-red-50 border-red-200 font-semibold'
    };
  } else if (diffDays === 0) {
    return {
      status: 'today',
      text: 'Due Today',
      color: 'text-amber-700 bg-amber-50 border-amber-200 font-semibold animate-pulse'
    };
  } else if (diffDays === 1) {
    return {
      status: 'tomorrow',
      text: 'Due tomorrow',
      color: 'text-amber-700 bg-amber-50 border-amber-200'
    };
  } else if (diffDays <= 7) {
    return {
      status: 'upcoming',
      text: `Due in ${diffDays} days`,
      color: 'text-blue-700 bg-blue-50 border-blue-200'
    };
  } else {
    return {
      status: 'future',
      text: `Due ${formatDate(dueDateStr)}`,
      color: 'text-slate-600 bg-slate-100 border-slate-200'
    };
  }
}

export function getRelationshipBadge(rel) {
  const r = (rel || '').toLowerCase();
  switch (r) {
    case 'family':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'friend':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'colleague':
    case 'coworker':
    case 'work':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'customer':
    case 'client':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'neighbor':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
