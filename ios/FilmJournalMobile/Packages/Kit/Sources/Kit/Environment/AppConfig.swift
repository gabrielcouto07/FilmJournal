import Foundation

/// Configuração de ambiente do app — aponta para o backend `api/` (Fastify, JWT), não para o
/// `web/` (Next.js). As duas apps rodam em portas separadas desde a refatoração que os dividiu
/// (`api/.env.example` define `PORT=4000` por padrão).
public struct AppConfig {
    public var baseURL: URL
    public var requestTimeout: TimeInterval

    public init(baseURL: URL, requestTimeout: TimeInterval = 20) {
        self.baseURL = baseURL
        self.requestTimeout = requestTimeout
    }

    /// Backend local (`npm run dev` dentro de `api/`) via localhost — use em Debug no Simulator.
    public static let localhost = AppConfig(baseURL: URL(string: "http://localhost:4000")!)

    /// Backend local acessado de um device físico na mesma rede — ajuste o IP da sua máquina.
    public static func lan(host: String, port: Int = 4000) -> AppConfig {
        AppConfig(baseURL: URL(string: "http://\(host):\(port)")!)
    }

    public static func production(host: String) -> AppConfig {
        AppConfig(baseURL: URL(string: "https://\(host)")!)
    }
}
