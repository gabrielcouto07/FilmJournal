import Foundation

/// Espelha `COUNTRY_NAMES` em `PalateCharts.tsx` do web — países conhecidos; os demais aparecem
/// pelo código ISO.
enum CountryNames {
    private static let names: [String: String] = [
        "US": "Estados Unidos", "GB": "Reino Unido", "FR": "França", "JP": "Japão", "KR": "Coreia do Sul",
        "BR": "Brasil", "DE": "Alemanha", "IT": "Itália", "ES": "Espanha", "CA": "Canadá", "AU": "Austrália",
        "CN": "China", "HK": "Hong Kong", "IN": "Índia", "SE": "Suécia", "DK": "Dinamarca", "RU": "Rússia",
        "MX": "México", "AR": "Argentina", "IE": "Irlanda", "NZ": "Nova Zelândia", "BE": "Bélgica",
        "NL": "Países Baixos", "NO": "Noruega", "PL": "Polônia", "TW": "Taiwan", "TH": "Tailândia",
        "IR": "Irã", "FI": "Finlândia", "CZ": "Chéquia", "AT": "Áustria", "PT": "Portugal",
    ]

    static func label(for code: String) -> String { names[code] ?? code }
}
