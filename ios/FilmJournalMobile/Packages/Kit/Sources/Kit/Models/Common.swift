import Foundation

/// Resposta comum a diversas mutações — só carrega a mensagem pt-BR de sucesso.
public struct MessageResponse: Decodable, Sendable {
    public let message: String?
}

public struct OKResponse: Decodable, Sendable {
    public let ok: Bool
}

/// Nota em incrementos de meia estrela — o backend sempre valida `0.5...5.0`, múltiplo de 0.5.
public enum Rating {
    public static let range: ClosedRange<Double> = 0.5...5.0
    public static let step: Double = 0.5

    public static func isValid(_ value: Double) -> Bool {
        range.contains(value) && (value * 2).rounded() == value * 2
    }
}
