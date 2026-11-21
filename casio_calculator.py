"""Simple Casio-style desktop calculator using Python's built-in tkinter."""

import ast
import math
import operator
import re
import tkinter as tk

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}

_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

OPERATORS = ("+", "-", "×", "÷")


def _eval_ast(node: ast.AST) -> float:
    """Recursively evaluate a restricted arithmetic AST node."""
    if isinstance(node, ast.Expression):
        return _eval_ast(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return float(node.value)
        raise ValueError("Invalid constant")
    if isinstance(node, ast.BinOp):
        op_fn = _BIN_OPS.get(type(node.op))
        if op_fn is None:
            raise ValueError("Unsupported operator")
        return op_fn(_eval_ast(node.left), _eval_ast(node.right))
    if isinstance(node, ast.UnaryOp):
        op_fn = _UNARY_OPS.get(type(node.op))
        if op_fn is None:
            raise ValueError("Unsupported unary operator")
        return op_fn(_eval_ast(node.operand))
    raise ValueError("Unsupported expression")


def safe_eval(expr: str) -> float:
    """Safely evaluate a basic arithmetic expression (+, -, ×, ÷)."""
    normalized = expr.replace("×", "*").replace("÷", "/").strip()
    if not normalized:
        raise ValueError("Empty expression")

    tree = ast.parse(normalized, mode="eval")
    result = float(_eval_ast(tree))
    if not math.isfinite(result):
        raise OverflowError("Result is not finite")
    return result


def format_result(value: float) -> str:
    """Format a float cleanly for the calculator LCD."""
    if value == 0:
        value = 0.0
    return f"{value:.10g}"


class CasioCalculator(tk.Tk):
    """Minimal Casio-style GUI calculator supporting +, -, ×, ÷."""

    BG_BODY = "#262A30"
    BG_BEZEL = "#1A1D21"
    BG_LCD = "#C9D6B5"
    FG_LCD = "#1B2216"
    FG_LCD_SUB = "#45523B"

    def __init__(self) -> None:
        super().__init__()
        self.title("CASIO Calculator")
        self.configure(bg=self.BG_BODY, padx=14, pady=14)
        self.resizable(False, False)

        self.expression = ""
        self.just_evaluated = False
        self.has_error = False

        self.expr_var = tk.StringVar(value="")
        self.result_var = tk.StringVar(value="0")

        self._build_header()
        self._build_display()
        self._build_keypad()
        self.bind("<Key>", self._on_key_press)

    def _build_header(self) -> None:
        header = tk.Frame(self, bg=self.BG_BODY)
        header.pack(fill="x", pady=(0, 10))

        tk.Label(
            header,
            text="CASIO",
            font=("Arial", 13, "bold"),
            fg="#F1F3F5",
            bg=self.BG_BODY,
        ).pack(side="left")

        right_box = tk.Frame(header, bg=self.BG_BODY)
        right_box.pack(side="right")

        tk.Label(
            right_box,
            text="fx-SIMPLE",
            font=("Arial", 9, "italic"),
            fg="#9AA2AE",
            bg=self.BG_BODY,
        ).pack(side="left", padx=(0, 8))

        # Decorative solar panel strip with 3 dividers
        solar = tk.Frame(
            right_box,
            bg="#3B2F2F",
            width=64,
            height=18,
            highlightbackground="#15171A",
            highlightthickness=1,
        )
        solar.pack(side="left")
        solar.pack_propagate(False)
        for col in range(1, 4):
            tk.Frame(solar, bg="#564747", width=1).place(
                relx=col / 4, rely=0, relheight=1
            )

    def _build_display(self) -> None:
        bezel = tk.Frame(
            self,
            bg=self.BG_BEZEL,
            padx=4,
            pady=4,
            relief="sunken",
            bd=2,
        )
        bezel.pack(fill="x", pady=(0, 14))

        lcd = tk.Frame(bezel, bg=self.BG_LCD, padx=10, pady=8)
        lcd.pack(fill="x")

        tk.Label(
            lcd,
            textvariable=self.expr_var,
            font=("Consolas", 11),
            fg=self.FG_LCD_SUB,
            bg=self.BG_LCD,
            anchor="e",
            width=22,
        ).pack(fill="x")

        tk.Label(
            lcd,
            textvariable=self.result_var,
            font=("Consolas", 24, "bold"),
            fg=self.FG_LCD,
            bg=self.BG_LCD,
            anchor="e",
            width=14,
        ).pack(fill="x", pady=(2, 0))

    def _build_keypad(self) -> None:
        pad = tk.Frame(self, bg=self.BG_BODY)
        pad.pack(fill="both", expand=True)

        for col in range(4):
            pad.grid_columnconfigure(col, weight=1, uniform="col")
        for row in range(5):
            pad.grid_rowconfigure(row, weight=1, uniform="row")

        # (label, row, col, rowspan, colspan, bg, hover_bg, command)
        buttons = [
            ("AC", 0, 0, 1, 1, "#D9534F", "#E26A66", self.clear),
            ("DEL", 0, 1, 1, 1, "#D97736", "#E38A4F", self.backspace),
            ("÷", 0, 2, 1, 1, "#5C6470", "#6D7684", lambda: self.press_char("÷")),
            ("×", 0, 3, 1, 1, "#5C6470", "#6D7684", lambda: self.press_char("×")),
            ("7", 1, 0, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("7")),
            ("8", 1, 1, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("8")),
            ("9", 1, 2, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("9")),
            ("-", 1, 3, 1, 1, "#5C6470", "#6D7684", lambda: self.press_char("-")),
            ("4", 2, 0, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("4")),
            ("5", 2, 1, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("5")),
            ("6", 2, 2, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("6")),
            ("+", 2, 3, 1, 1, "#5C6470", "#6D7684", lambda: self.press_char("+")),
            ("1", 3, 0, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("1")),
            ("2", 3, 1, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("2")),
            ("3", 3, 2, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char("3")),
            ("=", 3, 3, 2, 1, "#2F6FD0", "#3F80E0", self.calculate),
            ("0", 4, 0, 1, 2, "#3E444D", "#4D545F", lambda: self.press_char("0")),
            (".", 4, 2, 1, 1, "#3E444D", "#4D545F", lambda: self.press_char(".")),
        ]

        for label, row, col, rowspan, colspan, bg, hover_bg, cmd in buttons:
            btn = tk.Button(
                pad,
                text=label,
                command=cmd,
                font=("Arial", 14, "bold"),
                fg="#FFFFFF",
                bg=bg,
                activeforeground="#FFFFFF",
                activebackground=hover_bg,
                relief="raised",
                bd=2,
                cursor="hand2",
                width=4,
                height=2,
            )
            btn.grid(
                row=row,
                column=col,
                rowspan=rowspan,
                columnspan=colspan,
                sticky="nsew",
                padx=4,
                pady=4,
            )
            btn.bind("<Enter>", lambda _e, b=btn, c=hover_bg: b.configure(bg=c))
            btn.bind("<Leave>", lambda _e, b=btn, c=bg: b.configure(bg=c))

    def _current_number_segment(self) -> str:
        """Return the active number token after the last operator."""
        return re.split(r"[+\-×÷]", self.expression)[-1]

    def press_char(self, ch: str) -> None:
        """Append a digit, decimal point, or operator to the expression."""
        if self.has_error:
            self.clear()

        if ch in OPERATORS:
            if self.just_evaluated:
                self.just_evaluated = False
            if not self.expression:
                self.expression = "-" if ch == "-" else f"0{ch}"
            elif self.expression[-1] in OPERATORS:
                # Keep a lone leading minus instead of replacing it with +, ×, ÷.
                if self.expression != "-":
                    self.expression = self.expression[:-1] + ch
            else:
                self.expression += ch
        elif ch == ".":
            if self.just_evaluated:
                self.expression = "0."
                self.just_evaluated = False
            else:
                segment = self._current_number_segment()
                if "." in segment:
                    return
                self.expression += "0." if not segment else "."
        elif ch in "0123456789":
            if self.just_evaluated:
                self.expression = ch
                self.just_evaluated = False
            else:
                # Avoid leading zeros like "07" which raise SyntaxError in Python AST.
                segment = self._current_number_segment()
                if segment == "0":
                    self.expression = self.expression[:-1] + ch
                else:
                    self.expression += ch
        else:
            return

        self.expr_var.set("")
        self.result_var.set(self.expression or "0")

    def clear(self) -> None:
        """Reset calculator state (AC)."""
        self.expression = ""
        self.just_evaluated = False
        self.has_error = False
        self.expr_var.set("")
        self.result_var.set("0")

    def backspace(self) -> None:
        """Delete the last character (DEL)."""
        if self.has_error:
            self.clear()
            return
        if not self.expression:
            return
        self.just_evaluated = False
        self.expression = self.expression[:-1]
        self.expr_var.set("")
        self.result_var.set(self.expression or "0")

    def calculate(self) -> None:
        """Evaluate the current expression and display the result."""
        if self.has_error or not self.expression:
            return

        expr_to_eval = self.expression
        try:
            result = format_result(safe_eval(expr_to_eval))
        except (ZeroDivisionError, OverflowError):
            self._show_error(expr_to_eval, "Math ERROR")
            return
        except (SyntaxError, ValueError):
            self._show_error(expr_to_eval, "Syntax ERROR")
            return

        self.expr_var.set(f"{expr_to_eval} =")
        self.result_var.set(result)
        self.expression = result
        self.just_evaluated = True

    def _show_error(self, expr: str, message: str) -> None:
        self.expr_var.set(f"{expr} =")
        self.result_var.set(message)
        self.expression = ""
        self.has_error = True
        self.just_evaluated = False

    def _on_key_press(self, event: tk.Event) -> None:
        """Handle keyboard shortcuts for digits, operators, Enter, Backspace, Esc."""
        if event.keysym in ("Return", "KP_Enter") or event.char == "=":
            self.calculate()
        elif event.keysym == "BackSpace":
            self.backspace()
        elif event.keysym in ("Escape", "Delete"):
            self.clear()
        elif event.char == "*":
            self.press_char("×")
        elif event.char == "/":
            self.press_char("÷")
        elif event.char in "0123456789.+-":
            self.press_char(event.char)


if __name__ == "__main__":
    CasioCalculator().mainloop()
