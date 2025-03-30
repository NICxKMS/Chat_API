const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const MODEL_SERVICE_URL = 'http://localhost:8080';

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    console.log(`Received request: ${req.method} ${req.url}`);
    
    // Serve the index.html file
    if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end(`Error loading index.html: ${err.message}`);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        });
        return;
    }
    
    // Serve the test-browser.html file
    if (req.url === '/test' || req.url === '/test-browser.html') {
        const filePath = path.join(__dirname, 'test-browser.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end(`Error loading test-browser.html: ${err.message}`);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        });
        return;
    }
    
    // Proxy requests to the Go microservice
    if (req.url === '/health' || req.url === '/models' || req.url === '/dynamic') {
        const targetUrl = `${MODEL_SERVICE_URL}${req.url}`;
        console.log(`Proxying request to: ${targetUrl}`);
        
        const isHttps = targetUrl.startsWith('https');
        const httpModule = isHttps ? https : http;
        const parsedUrl = new URL(targetUrl);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: req.method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Handle body data for POST requests
        if (req.method === 'POST') {
            let body = [];
            req.on('data', chunk => {
                body.push(chunk);
            }).on('end', () => {
                body = Buffer.concat(body).toString();
                console.log(`Request body: ${body}`);
                
                const proxyReq = httpModule.request(options, proxyRes => {
                    console.log(`Response status: ${proxyRes.statusCode}`);
                    
                    // Set headers from proxy response
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    
                    let responseData = '';
                    proxyRes.on('data', chunk => {
                        responseData += chunk;
                    });
                    
                    proxyRes.on('end', () => {
                        console.log(`Response body: ${responseData}`);
                        res.end(responseData);
                    });
                });
                
                proxyReq.on('error', e => {
                    console.error(`Problem with proxy request: ${e.message}`);
                    res.writeHead(500);
                    res.end(JSON.stringify({ 
                        status: 'error', 
                        message: `Proxy error: ${e.message}` 
                    }));
                });
                
                // Set request headers
                if (req.headers['content-type']) {
                    proxyReq.setHeader('Content-Type', req.headers['content-type']);
                }
                
                if (req.headers['content-length']) {
                    proxyReq.setHeader('Content-Length', body.length);
                }
                
                console.log('Writing request body to proxy request');
                proxyReq.write(body);
                proxyReq.end();
            });
        } else {
            // For GET requests
            httpModule.get(options, proxyRes => {
                console.log(`Response status: ${proxyRes.statusCode}`);
                
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                
                let responseData = '';
                proxyRes.on('data', chunk => {
                    responseData += chunk;
                });
                
                proxyRes.on('end', () => {
                    console.log(`Response body: ${responseData}`);
                    res.end(responseData);
                });
            }).on('error', e => {
                console.error(`Problem with proxy request: ${e.message}`);
                res.writeHead(500);
                res.end(JSON.stringify({ 
                    status: 'error', 
                    message: `Proxy error: ${e.message}` 
                }));
            });
        }
        return;
    }
    
    // Handle 404
    res.writeHead(404);
    res.end('404 Not Found');
});

server.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
    console.log(`Proxying requests to the model-categorizer service at ${MODEL_SERVICE_URL}`);
}); 