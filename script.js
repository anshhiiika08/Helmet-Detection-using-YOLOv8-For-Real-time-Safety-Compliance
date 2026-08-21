document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewArea = document.getElementById('preview-area');
    const imagePreview = document.getElementById('image-preview');
    const analyzeBtn = document.getElementById('analyze-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const loadingState = document.getElementById('loading-state');
    const resultsSection = document.getElementById('results-section');
    const resultImage = document.getElementById('result-image');
    const detectionsUl = document.getElementById('detections-ul');
    const newScanBtn = document.getElementById('new-scan-btn');

    let selectedFile = null;

    // Base API URL
    const API_URL = 'http://127.0.0.1:8000';

    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                selectedFile = file;
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = function () {
                    imagePreview.src = reader.result;
                    uploadArea.classList.add('hidden');
                    previewArea.classList.remove('hidden');
                }
            } else {
                alert('Please upload an image file.');
            }
        }
    }

    cancelBtn.addEventListener('click', () => {
        resetUI();
    });

    newScanBtn.addEventListener('click', () => {
        resetUI();
    });

    function resetUI() {
        selectedFile = null;
        fileInput.value = '';
        imagePreview.src = '';
        uploadArea.classList.remove('hidden');
        previewArea.classList.add('hidden');
        resultsSection.classList.add('hidden');
        loadingState.classList.add('hidden');
        document.querySelector('.upload-section').classList.remove('hidden');
    }

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI transitions
        document.querySelector('.upload-section').classList.add('hidden');
        loadingState.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch(`${API_URL}/predict/`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);
        } catch (error) {
            console.error('Error during analysis:', error);
            alert('An error occurred during analysis. Make sure the backend is running at ' + API_URL);
            resetUI();
        }
    });

    function displayResults(data) {
        loadingState.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        // Note: data.result_url might be absolute if the API provides it.
        resultImage.src = data.result_url;

        // Setup download button
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.href = data.result_url;
        }

        // Clear previous detections
        detectionsUl.innerHTML = '';

        if (data.detections.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No detections found.';
            detectionsUl.appendChild(li);
        } else {
            data.detections.forEach((det, index) => {
                const li = document.createElement('li');
                li.style.flexDirection = 'column';
                li.style.alignItems = 'flex-start';
                li.style.gap = '0.5rem';

                const topRow = document.createElement('div');
                topRow.style.display = 'flex';
                topRow.style.justifyContent = 'space-between';
                topRow.style.width = '100%';

                const labelSpan = document.createElement('span');
                labelSpan.textContent = `Object ${index + 1}: ${det.label} (Class ID: ${det.class_id})`;

                const confSpan = document.createElement('span');
                confSpan.classList.add('badge');

                // Assuming typical labels might be 'helmet', 'no-helmet' or 'head'
                if (det.label.toLowerCase().includes('helmet') && !det.label.toLowerCase().includes('no')) {
                    confSpan.classList.add('badge-helmet');
                } else if (det.label.toLowerCase().includes('no') || det.label.toLowerCase().includes('head')) {
                    confSpan.classList.add('badge-no-helmet');
                } else {
                    confSpan.classList.add('badge-helmet'); // default styling
                    confSpan.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    confSpan.style.color = '#fff';
                }

                confSpan.textContent = `Confidence: ${(det.confidence * 100).toFixed(1)}%`;

                topRow.appendChild(labelSpan);
                topRow.appendChild(confSpan);

                const bboxDiv = document.createElement('div');
                bboxDiv.style.fontSize = '0.85rem';
                bboxDiv.style.color = 'var(--text-muted)';
                bboxDiv.textContent = `Bounding Box: [${det.box.map(n => Math.round(n)).join(', ')}]`;

                li.appendChild(topRow);
                li.appendChild(bboxDiv);
                detectionsUl.appendChild(li);
            });
        }
    }
});
