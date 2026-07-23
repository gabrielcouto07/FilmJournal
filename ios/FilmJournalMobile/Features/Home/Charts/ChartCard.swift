import SwiftUI
import DesignKit

/// Envelope visual dos gráficos da Home — espelha `Card` em `TasteDashboard.tsx` do web
/// (eyebrow dourado + título + conteúdo, sobre um "surface" translúcido).
struct ChartCard<Content: View>: View {
    let eyebrow: String
    let heading: String
    var note: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(eyebrow.uppercased())
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(1.4)
                        .foregroundStyle(Color.fjAccent)
                    Text(heading)
                        .font(.title3.bold())
                        .foregroundStyle(Color.fjText)
                }
                Spacer()
                if let note {
                    Text(note)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.fjMuted)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 160)
                }
            }
            content
            Spacer(minLength: 0)
        }
        .padding(Spacing.md)
        // Quando dois cards dividem uma `HStack` (ver `HomeChartsSection`), o mais curto estica
        // até a altura do mais alto em vez de deixar as caixas com tamanhos diferentes; fora de
        // uma `HStack` (cards em largura cheia) isto não tem efeito, já que o `ScrollView` propõe
        // altura livre e cada card fica do tamanho do seu próprio conteúdo.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.fjSurface2)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large))
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadius.large)
                .strokeBorder(Color.fjLine, lineWidth: 1)
        )
    }
}

/// Espelha `Insufficient` do web — placeholder para gráficos sem dados suficientes.
struct InsufficientDataView: View {
    var message = "Dados insuficientes ainda."

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(Color.fjMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xl)
            .multilineTextAlignment(.center)
    }
}
