const token = localStorage.getItem('gatekeeperToken');
const API_BASE = 'http://localhost:5000/api/outpass';

if (!token) {
    window.location.href = './gatekeeper-login.html';
}

async function loadNotReturned() {
    try {
        const res = await fetch(`${API_BASE}/gatekeeper/not-returned`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('studentTable');
        tbody.innerHTML = '';

        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No students pending return</td></tr>`;
            return;
        }

        data.data.forEach(student => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${student.userId?.name || 'N/A'}</td>
                <td>${student.userId?.email || 'N/A'}</td>
                <td>${student.userId?.collegeId || 'N/A'}</td>
                <td>${student.isReturn ? 'Returned' : 'Not Returned'}</td>
                <td>
                    ${!student.isReturn ? `<button onclick="markReturned('${student._id}')">Mark Returned</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading students:', err);
    }
}

async function markReturned(id) {
    try {
        await fetch(`${API_BASE}/gatekeeper/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        loadNotReturned();
    } catch (err) {
        console.error('Error marking returned:', err);
    }
}

document.getElementById('markAllBtn').addEventListener('click', async () => {
    try {
        await fetch(`${API_BASE}/gatekeeper/mark-all-returned`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        loadNotReturned();
    } catch (err) {
        console.error('Error marking all returned:', err);
    }
});

// Load initially and refresh every 30s
loadNotReturned();
setInterval(loadNotReturned, 30000);



