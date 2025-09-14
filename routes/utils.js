function getWeekNumber(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date - start;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    return Math.ceil(days / 7);
}

module.exports = { getWeekNumber };
