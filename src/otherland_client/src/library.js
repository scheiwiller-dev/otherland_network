// Library functionality for local storage of uploaded objects

// Load library objects from localStorage and display in table
export function loadLibraryObjects() {
    const tbody = document.getElementById('library-object-tbody');
    tbody.innerHTML = ''; // Clear existing rows

    const stored = localStorage.getItem('libraryObjects');
    const libraryObjects = stored ? JSON.parse(stored) : [];

    if (libraryObjects.length === 0) {
        document.getElementById('library-object-list').style.display = 'none';
        return;
    } else {

        document.getElementById('library-object-list').style.display = 'block';
        libraryObjects.forEach(obj => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = obj.id;

            const descCell = document.createElement('td');
            descCell.textContent = obj.description || obj.filename;

            const actionsCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteLibraryObject(obj.id);
            actionsCell.appendChild(deleteBtn);

            row.appendChild(idCell);
            row.appendChild(descCell);
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });
    }
}

// Delete object from library
export function deleteLibraryObject(objectId) {
    if (!confirm('Are you sure you want to delete this object from your library?')) {
        return;
    }

    const stored = localStorage.getItem('libraryObjects');
    const libraryObjects = stored ? JSON.parse(stored) : [];
    const filteredObjects = libraryObjects.filter(obj => obj.id !== objectId);

    localStorage.setItem('libraryObjects', JSON.stringify(filteredObjects));
    loadLibraryObjects();

    console.log(`Deleted object ${objectId} from library`);
}

// Generate unique object ID
export function generateObjectId() {
    return 'khet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Read file as Data URL
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}