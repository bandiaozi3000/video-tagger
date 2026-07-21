const input = document.getElementById('backend');
const status = document.getElementById('status');

chrome.storage.sync.get('backendBaseUrl', ({ backendBaseUrl }) => {
  input.value = backendBaseUrl || 'http://localhost:8080';
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({ backendBaseUrl: input.value.trim() }, () => {
    status.textContent = '已保存';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
});
