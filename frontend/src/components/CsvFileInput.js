import React, { useCallback } from 'react';

const CsvFileInput = ({ onFileLoad }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        // Assuming the CSV data is being parsed into an array of objects here
        const parsedData = parseCsv(text);
        onFileLoad(parsedData);
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
    // Implement your CSV parsing logic here
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce((obj, header, index) => {
        obj[header.trim()] = values[index].trim();
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
