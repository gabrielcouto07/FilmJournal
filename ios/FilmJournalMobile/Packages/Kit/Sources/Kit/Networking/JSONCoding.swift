import Foundation

/// Codificação/decodificação compartilhada por todo o client — casa com o formato do Prisma
/// (`DateTime` serializado em ISO 8601 com milissegundos, ex. "2024-01-15T10:30:00.000Z").
enum JSONCoding {
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoderValue in
            let container = try decoderValue.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = isoWithFractionalSeconds.date(from: string) { return date }
            if let date = isoPlain.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Data em formato inesperado: \(string)")
        }
        return decoder
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoderValue in
            var container = encoderValue.singleValueContainer()
            try container.encode(isoWithFractionalSeconds.string(from: date))
        }
        return encoder
    }()

    private static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

/// Datas "AAAA-MM-DD" (sem hora) usadas em campos como `watchedAt` no corpo das requisições.
public enum DayString {
    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.calendar = Calendar(identifier: .gregorian)
        return formatter
    }()

    public static func string(from date: Date) -> String {
        formatter.string(from: date)
    }

    public static func date(from string: String) -> Date? {
        formatter.date(from: string)
    }
}
