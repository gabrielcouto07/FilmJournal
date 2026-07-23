import CoreGraphics

/// Escala de espaçamento mínima — só o suficiente para os placeholders estruturais das telas.
/// A UI final (cores, tipografia, layout) é responsabilidade do restante do time.
public enum Spacing {
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 16
    public static let lg: CGFloat = 24
    public static let xl: CGFloat = 32
}

/// Espelha `--radius-sm/md/lg` do web (`globals.css`, em `rem`, 1rem = 16pt).
public enum CornerRadius {
    public static let small: CGFloat = 12
    public static let medium: CGFloat = 18
    public static let large: CGFloat = 28
}
