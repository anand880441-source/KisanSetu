export const getToken = () => {
    const token = localStorage.getItem('token');
    return (token && token !== 'undefined' && token !== 'null') ? token : null;
};

export const setToken = (token) => {
    if (token && token !== 'undefined') {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
};

export const removeToken = () => localStorage.removeItem('token');

export const getUser = () => {
    try {
        const user = localStorage.getItem('user');
        if (!user || user === 'undefined' || user === 'null') return null;
        return JSON.parse(user);
    } catch (err) {
        console.error('Failed to parse stored user from localStorage:', err);
        localStorage.removeItem('user');
        return null;
    }
};

export const setUser = (user) => {
    if (user && typeof user === 'object') {
        localStorage.setItem('user', JSON.stringify(user));
    } else {
        localStorage.removeItem('user');
    }
};

export const removeUser = () => localStorage.removeItem('user');

export const clearAuth = () => {
    removeToken();
    removeUser();
};
