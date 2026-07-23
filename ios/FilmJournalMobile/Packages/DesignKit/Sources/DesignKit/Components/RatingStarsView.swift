import SwiftUI

/// Exibição somente-leitura de nota em meia-estrela (0.5–5.0) — mesma escala usada em toda a
/// API (`Rating` em `Kit`). Edição interativa fica a critério da UI final.
public struct RatingStarsView: View {
    private let rating: Double?
    private let maxStars: Int

    public init(rating: Double?, maxStars: Int = 5) {
        self.rating = rating
        self.maxStars = maxStars
    }

    public var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<maxStars, id: \.self) { index in
                Image(systemName: symbolName(for: index))
                    .foregroundStyle(Color.fjAccent)
                    .font(.caption)
            }
        }
        .accessibilityLabel(rating.map { "Nota \($0, specifier: "%.1f") de \(maxStars)" } ?? "Sem nota")
    }

    private func symbolName(for index: Int) -> String {
        guard let rating else { return "star" }
        let filled = rating - Double(index)
        if filled >= 1 { return "star.fill" }
        if filled >= 0.5 { return "star.leadinghalf.filled" }
        return "star"
    }
}

#Preview("Notas variadas") {
    VStack(alignment: .leading, spacing: Spacing.sm) {
        RatingStarsView(rating: 5.0)
        RatingStarsView(rating: 3.5)
        RatingStarsView(rating: 0.5)
        RatingStarsView(rating: nil)
    }
    .padding()
    .background(Color.fjCanvas)
}
