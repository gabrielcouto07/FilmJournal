import SwiftUI
import Charts
import Kit
import DesignKit

/// Sua nota contra a nota do público, um ponto por filme.
struct ContrarianScatterChart: View {
    let points: [ContrarianPoint]

    private struct DiagonalPoint: Identifiable { let x: Double; let y: Double; var id: Double { x } }
    private let diagonal = [DiagonalPoint(x: 0, y: 0), DiagonalPoint(x: 5, y: 5)]

    private func color(for delta: Double) -> Color {
        if delta >= 0.5 { return .fjAccent }
        if delta <= -0.5 { return .fjBlue }
        return Color(hex: "#6b655c")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Chart {
                ForEach(diagonal) { point in
                    LineMark(x: .value("Público", point.x), y: .value("Você", point.y))
                }
                .foregroundStyle(Color.fjMuted)
                .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))

                ForEach(points) { point in
                    PointMark(x: .value("Público", point.crowdRating), y: .value("Você", point.userRating))
                        .foregroundStyle(color(for: point.delta))
                        .symbolSize(60)
                }
            }
            .chartXScale(domain: 0...5)
            .chartYScale(domain: 0...5)
            .chartXAxis {
                AxisMarks(values: [0, 1, 2, 3, 4, 5]) { _ in
                    AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted)
                }
            }
            .chartYAxis {
                AxisMarks(values: [0, 1, 2, 3, 4, 5]) { _ in
                    AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted)
                }
            }
            .frame(height: 300)

            HStack(spacing: Spacing.md) {
                legendDot(color: .fjAccent, label: "Você gosta mais")
                legendDot(color: .fjBlue, label: "Você gosta menos")
                legendDot(color: Color(hex: "#6b655c"), label: "Concordam")
            }
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Color.fjMuted)
        }
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
        }
    }
}
