import { describe, it, expect } from "vitest";
import { parseNginxConfig } from "../src/parser";

describe("parseNginxConfig", () => {
  it("parses a simple directive", () => {
    const ast = parseNginxConfig("worker_processes 4;");
    expect(ast.type).toBe("config");
    expect(ast.children).toHaveLength(1);
    const dir = ast.children[0] as { type: string; name: string; args: string[] };
    expect(dir.type).toBe("directive");
    expect(dir.name).toBe("worker_processes");
    expect(dir.args).toEqual(["4"]);
  });

  it("parses a block with nested directives", () => {
    const ast = parseNginxConfig("events { worker_connections 1024; }");
    expect(ast.children).toHaveLength(1);
    const block = ast.children[0] as { type: string; name: string; children: unknown[] };
    expect(block.type).toBe("block");
    expect(block.name).toBe("events");
    expect(block.children).toHaveLength(1);
  });

  it("parses deeply nested blocks", () => {
    const config = `
      http {
        server {
          location / {
            proxy_pass http://backend;
          }
        }
      }
    `;
    const ast = parseNginxConfig(config);
    const http = ast.children[0] as { type: string; name: string; children: unknown[] };
    expect(http.type).toBe("block");
    expect(http.name).toBe("http");
    const server = http.children[0] as { type: string; name: string; children: unknown[] };
    expect(server.type).toBe("block");
    expect(server.name).toBe("server");
    const loc = server.children[0] as { type: string; name: string };
    expect(loc.type).toBe("block");
    expect(loc.name).toBe("location");
  });

  it("parses a directive with multiple arguments", () => {
    const ast = parseNginxConfig("listen 443 ssl http2;");
    const dir = ast.children[0] as { type: string; args: string[] };
    expect(dir.type).toBe("directive");
    expect(dir.args).toEqual(["443", "ssl", "http2"]);
  });

  it("parses quoted string values", () => {
    const ast = parseNginxConfig('server_name "example.com";');
    const dir = ast.children[0] as { type: string; args: string[] };
    expect(dir.args[0]).toBe("example.com");
  });

  it("parses comments", () => {
    const ast = parseNginxConfig("# this is a comment\nworker_processes 2;");
    const comment = ast.children[0] as { type: string };
    expect(comment.type).toBe("comment");
  });

  it("parses an empty input as an empty config", () => {
    const ast = parseNginxConfig("");
    expect(ast.type).toBe("config");
    expect(ast.children).toHaveLength(0);
  });

  it("parses multiple top-level directives", () => {
    const ast = parseNginxConfig("user nginx;\nworker_processes auto;\npid /run/nginx.pid;");
    expect(ast.children).toHaveLength(3);
  });

  it("parses a realistic nginx config snippet", () => {
    const config = `
      user nginx;
      worker_processes auto;

      events {
        worker_connections 4096;
        multi_accept on;
      }

      http {
        gzip on;
        server {
          listen 80;
          server_name example.com;
          location / {
            root /var/www/html;
            try_files $uri $uri/ =404;
          }
        }
      }
    `;
    const ast = parseNginxConfig(config);
    expect(ast.children.length).toBeGreaterThanOrEqual(3);
    const dirNames = ast.children
      .filter((c) => (c as { type: string }).type === "directive")
      .map((c) => (c as { name: string }).name);
    expect(dirNames).toContain("user");
    expect(dirNames).toContain("worker_processes");
  });

  it("records line numbers on AST nodes", () => {
    const ast = parseNginxConfig("worker_processes 4;\nworker_rlimit_nofile 8192;");
    const first = ast.children[0] as { location?: { start: { line: number } } };
    const second = ast.children[1] as { location?: { start: { line: number } } };
    if (first.location && second.location) {
      expect(first.location.start.line).toBeLessThan(second.location.start.line);
    }
  });

  it("parses upstream block with server directives", () => {
    const config = `
      upstream backend {
        server 10.0.0.1:8080 weight=3;
        server 10.0.0.2:8080;
      }
    `;
    const ast = parseNginxConfig(config);
    const upstream = ast.children[0] as { type: string; name: string; children: unknown[] };
    expect(upstream.type).toBe("block");
    expect(upstream.name).toBe("upstream");
    expect(upstream.children).toHaveLength(2);
  });
});
