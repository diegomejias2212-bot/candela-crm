"""
Candela CRM - Servidor Local
Ejecutar con: python server.py
Acceder desde PC: http://localhost:5000
Acceder desde celular: http://[TU_IP_LOCAL]:5000
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import socket

PORT = 5000
DATA_FILE = 'data.json'

class CRMHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                self.wfile.write(f.read().encode())
        elif self.path == '/' or self.path == '/index.html':
            self.path = '/index.html'
            return SimpleHTTPRequestHandler.do_GET(self)
        else:
            return SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        if self.path == '/api/data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def get_local_ip():
    """Obtiene la IP local para acceso desde celular"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    local_ip = get_local_ip()
    
    print("=" * 50)
    print("🔥 CANDELA CRM - Servidor Iniciado")
    print("=" * 50)
    print(f"\n📍 Acceso desde PC:")
    print(f"   http://localhost:{PORT}")
    print(f"\n📱 Acceso desde CELULAR (misma red WiFi):")
    print(f"   http://{local_ip}:{PORT}")
    print("\n💡 Presiona Ctrl+C para detener el servidor")
    print("=" * 50)
    
    server = HTTPServer(('0.0.0.0', PORT), CRMHandler)
    server.serve_forever()
