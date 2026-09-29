import { describe, expect, it } from "vitest";
import { envelopeAfterPay, envelopeChargePhrase, envelopeOptionRemain, weekOptionLabel } from "./envelope-charge";

const fmt = (value: number) => String(value);

describe("plata din plic spune depășirea, nu zero", () => {
  it("lasă restul când suma încape", () => {
    expect(envelopeAfterPay(100, 40)).toEqual({ left: 60, over: 0 });
  });

  it("spune cu cât iese peste, inclusiv dacă plicul era deja depășit", () => {
    expect(envelopeAfterPay(30, 50)).toEqual({ left: -20, over: 20 });
    expect(envelopeAfterPay(-10, 5)).toEqual({ left: -15, over: 15 });
    expect(envelopeAfterPay(19.99, 30).over).toBe(10.01);
  });

  it("nu scade o sumă lipsă sau nulă", () => {
    expect(envelopeAfterPay(40, 0)).toEqual({ left: 40, over: 0 });
    expect(envelopeAfterPay(40, Number.NaN)).toEqual({ left: 40, over: 0 });
  });

  it("propoziția folosește săptămâna primită și suma de după plată", () => {
    expect(envelopeChargePhrase({ weekIndex: 2, remaining: 40, budget: 100, pay: 70, format: fmt })).toEqual({
      text: "S2: 40 rămași din 100 · după plată, cu 30 peste",
      over: true,
    });
    expect(envelopeChargePhrase({ weekIndex: 1, remaining: -20, budget: 100, pay: 10, format: fmt }).text)
      .toBe("S1: deja cu 20 peste · după plată, cu 30 peste");
    expect(envelopeChargePhrase({ remaining: 80, budget: 200, pay: 30, format: fmt }).text)
      .toBe("80 rămași din 200 · după plată 50");
    expect(envelopeChargePhrase({ weekIndex: 1, remaining: -20, budget: 100, pay: 0, format: fmt }).text)
      .toBe("S1: deja cu 20 peste");
  });

  it("listele nu scriu zero când săptămâna e deja peste", () => {
    expect(weekOptionLabel(3, -12, 90, fmt)).toBe("S3: cu 12 peste din 90");
    expect(weekOptionLabel(3, 12, 90, fmt)).toBe("S3: 12 rămași din 90");
    expect(envelopeOptionRemain(-8, fmt, 2)).toBe("8 peste în S2");
    expect(envelopeOptionRemain(8, fmt, 2)).toBe("8 în S2");
    expect(envelopeOptionRemain(-8, fmt)).toBe("cu 8 peste");
  });
});
