import React, { useEffect, useRef, useState } from "react";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VegaLite } from 'react-vega';
import CsvFileInput from "./components/CsvFileInput";

const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:8000/' 
  : 'https://human-ai.onrender.com/';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [csvData, setCsvData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataPreviewVisible, setDataPreviewVisibility] = useState(false);
  const chatContainerRef = useRef(null);

  const handleCsvFileLoad = (data) => {
    // Check for undefined values and sanitize data
    const sanitizedData = data.map(row => 
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value ? value.trim() : ""])
      )
    );

    setCsvData(sanitizedData);
    setDataPreviewVisibility(true);
  };

  const handleInputChange = (e) => setInputText(e.target.value);

  const sendUserMessage = async () => {
    if (!inputText.trim()) return;

    const newMessage = { sender: "user", text: inputText };
    setMessages(prev => [...prev, newMessage]);
    setInputText("");
    setIsLoading(true);
    fetchBotResponse(inputText);
  };

  const fetchBotResponse = async (message) => {
    const prompt = JSON.stringify(message);
    if (!prompt) return;

    try {
      const response = await fetch(`${API_URL}query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, csv_data: JSON.stringify(csvData.slice(0, 10)) })
      });

      const data = await response.json();
      processBotResponse(data);
    } catch (error) {
      console.error("Error fetching bot response:", error);
      setIsLoading(false);
    }
  };

  const processBotResponse = (data) => {
    const { response, vega_lite_json } = data;
    const botMessage = { sender: "bot", text: response };

    try {
      const vegaSpec = JSON.parse(vega_lite_json);
      const keys = Object.keys(vegaSpec.data.values[0]);
      const filteredData = extractRelevantData(csvData, keys);
      vegaSpec.data.values = filteredData;
      botMessage.spec = vegaSpec;
    } catch {
      botMessage.spec = null;
    }

    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);
  };

  const extractRelevantData = (data, keys) => {
    return data.map(item => {
      return keys.reduce((acc, key) => {
        if (item[key] !== undefined) acc[key] = item[key];
        return acc;
      }, {});
    });
  };

  const toggleDataPreview = () => {
    setDataPreviewVisibility(prev => !prev);
  };

  const clearChatHistory = () => setMessages([]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [messages]);

  const renderDataPreview = () => {
    if (!csvData.length) return null;

    const headers = Object.keys(csvData[0]); // Display all columns
    const rowsToPreview = csvData.slice(0, 10);

    return (
      <div className="overflow-x-auto w-full">
        <div className="max-h-48 overflow-y-auto">
          <table className="table-auto border border-gray-300 my-4">
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="border border-gray-400 p-2 bg-gray-100 whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsToPreview.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((header, headerIndex) => (
                    <td
                      key={headerIndex}
                      className="border border-gray-400 p-2 whitespace-nowrap"
                    >
                      {row[header] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center h-screen p-6">
      <div className="flex-grow flex flex-col w-full max-w-4xl bg-white rounded-lg shadow-md p-6">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">Data Visualization Assistant</h1>
        <p className="text-center text-gray-600 mb-4">A powerful tool for visualizing your data effortlessly.</p>
        <div className="flex-grow flex flex-col bg-gray-50 rounded-lg p-4 mt-3">
          <CsvFileInput onFileLoad={handleCsvFileLoad} />
          <div className="flex justify-between mt-3">
            {isDataPreviewVisible && (
              <button 
                onClick={toggleDataPreview} 
                className="bg-blue-600 text-white rounded-lg px-2 py-1 hover:bg-blue-700 transition duration-300">
                Hide Data Preview
              </button>
            )}
            {!isDataPreviewVisible && (
              <button 
                onClick={toggleDataPreview} 
                className="bg-blue-600 text-white rounded-lg px-2 py-1 hover:bg-blue-700 transition duration-300">
                Show Data Preview
              </button>
            )}
          </div>
          {isDataPreviewVisible && renderDataPreview()}
          <div
            ref={chatContainerRef}
            className="h-[36rem] overflow-y-auto bg-white rounded-lg p-4 mt-3 mb-4 shadow-md" // Updated class
          >
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start my-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`${msg.sender === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-black"} rounded-lg p-3`}>
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                  {msg.spec && <div className="w-full my-4"><VegaLite spec={msg.spec} /></div>}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center items-center my-4">
                <p className="text-gray-500">Thinking...</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex mt-3">
          <input
            type="text"
            placeholder="Enter your message"
            className="flex-grow border border-gray-300 rounded-lg p-4 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={inputText}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && sendUserMessage()}
          />
          <button onClick={sendUserMessage} className="bg-blue-500 text-white rounded-lg ml-2 px-6 py-2 hover:bg-blue-600 transition duration-300">Send</button>
          <button onClick={clearChatHistory} className="bg-red-500 text-white rounded-lg ml-2 px-6 py-2 hover:bg-red-600 transition duration-300">Clear</button>
        </div>
      </div>
    </div>
  );
};

export default App;
