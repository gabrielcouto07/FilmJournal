import Foundation

/// Aponta para o backend, que roda em porta própria (4000 por padrão).
public struct AppConfig {
    public var baseURL: URL
    public var requestTimeout: TimeInterval

    public init(baseURL: URL, requestTimeout: TimeInterval = 20) {
        self.baseURL = baseURL
        self.requestTimeout = requestTimeout
    }

    /// Só funciona no Simulator; um device físico precisa de `lan(host:)`.
    public static let localhost = AppConfig(baseURL: URL(string: "http://localhost:4000")!)

    /// Para device físico na mesma rede — passe o IP da sua máquina.
    public static func lan(host: String, port: Int = 4000) -> AppConfig {
        AppConfig(baseURL: URL(string: "http://\(host):\(port)")!)
    }

    public static func production(host: String) -> AppConfig {
        AppConfig(baseURL: URL(string: "https://\(host)")!)
    }
}
