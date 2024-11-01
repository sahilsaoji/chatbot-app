import React from 'react';

const CsvFileInput = ({ onFileLoad }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const parsedData = parseCsv(text); // Parse and sanitize CSV data
        onFileLoad(parsedData); // Pass sanitized data to the parent component
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileChange({ target: { files: [file] } });
    }
  };

  const parseCsv = (text) => {
    const lines = text.split('\n').filter(line => line.trim() !== ""); // Remove empty lines
    const headers = lines[0].split(',').map(header => header.trim()); // Trim headers

    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce((obj, header, index) => {
        // Use trimmed value or empty string if undefined
        obj[header] = values[index] ? values[index].trim() : "";
        return obj;
      }, {});
    });
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="border-2 border-dashed border-gray-400 rounded-lg p-4 text-center"
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="csv-file-input"
      />
      <label htmlFor="csv-file-input" className="cursor-pointer">
        Click or Drag & Drop a CSV File
      </label>
    </div>
  );
};

export default CsvFileInput;
