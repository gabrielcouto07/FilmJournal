import SwiftUI
import Charts
import Kit
import DesignKit

/// Espelha "Ritmo de visualização" em `TasteDashboard.tsx` — sessões do diário por mês,
/// nos últimos 18 meses com registro.
struct MonthlyActivityChart: View {
    let data: [MonthBucket]

    private static let keyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM"
        return formatter
    }()

    private static let labelFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "MMM/yy"
        return formatter
    }()

    private func label(for key: String) -> String {
        guard let date = Self.keyFormatter.date(from: key) else { return key }
        return Self.labelFormatter.string(from: date)
    }

    var body: some View {
        Chart(data) { bucket in
            BarMark(
                x: .value("Mês", label(for: bucket.key)),
                y: .value("Sessões", bucket.count)
            )
            .foregroundStyle(
                LinearGradient(colors: [Color.fjAccent.opacity(0.4), Color.fjAccent], startPoint: .bottom, endPoint: .top)
            )
            .cornerRadius(3)
        }
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel(orientation: .verticalReversed) {
                    if let label = value.as(String.self) {
                        Text(label).font(.system(size: 9, weight: .bold)).foregroundStyle(Color.fjMuted)
                    }
                }
            }
        }
        .frame(height: 220)
    }
}
