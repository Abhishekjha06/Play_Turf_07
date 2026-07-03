import { View, Text, Image } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { InvoiceData } from "./types";

export function QRCodeSection({ data }: { data: InvoiceData }) {
  if (!data.qrCodeDataUrl) return null;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={styles.qrWrap}>
        <Image src={data.qrCodeDataUrl} style={styles.qrImage} />
      </View>
      <Text style={styles.qrLabel}>Scan to Verify</Text>
    </View>
  );
}
