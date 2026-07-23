import Foundation

/// Configuração de ambiente do app — aponta para a mesma API do FilmJournal (Next.js).
public struct AppConfig {
    public var baseURL: URL
    public var requestTimeout: TimeInterval

    public init(baseURL: URL, requestTimeout: TimeInterval = 20) {
        self.baseURL = baseURL
        self.requestTimeout = requestTimeout
    }

    /// Backend local (`npm run dev`) via localhost — use em Debug no Simulator.
    public static let localhost = AppConfig(baseURL: URL(string: "http://localhost:3000")!)

    /// Backend local acessado de um device físico na mesma rede — ajuste o IP da sua máquina.
    public static func lan(host: String, port: Int = 3000) -> AppConfig {
        AppConfig(baseURL: URL(string: "http://\(host):\(port)")!)
    }

    public static func production(host: String) -> AppConfig {
        AppConfig(baseURL: URL(string: "https://\(host)")!)
    }
}
