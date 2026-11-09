// Shrinks big photos in the browser before upload so they never hit the
// server's 10MB limit. Keeps up to 2560px on the long side (well above 800x600).
const MAX_SIDE = 2560
const SKIP_UNDER = 3 * 1024 * 1024 // already small: upload as is

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
        img.src = url
    })
}

export async function compressImage(file) {
    try {
        if (file.size <= SKIP_UNDER) return file
        const img = await loadImage(file)
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
        if (!blob || blob.size >= file.size) return file
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        return new File([blob], name, { type: 'image/jpeg' })
    } catch {
        return file
    }
}

export async function compressAll(files) {
    return Promise.all(files.map(compressImage))
}