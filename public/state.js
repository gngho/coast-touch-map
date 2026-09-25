const KEY = 'coast.labels.v1';
export function readLabels(){try{return localStorage.getItem(KEY)!=='false';}catch{return true;}}
export function saveLabels(value){try{localStorage.setItem(KEY,String(value));}catch{/* Preferences remain usable in memory. */}}
