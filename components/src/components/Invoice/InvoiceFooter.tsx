import { View, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { InvoiceData } from "./types";

export function InvoiceFooter({ data }: { data: InvoiceData }) {
  const company = data.companyName || "PlayTurf Technologies Pvt. Ltd.";
  const email = data.supportEmail || "support@playturf.in";
  const website = data.website || "www.playturf.in";

  return (
    <View style={styles.footer}>
      <View style={styles.footerLeft}>
        <Text style={styles.footerCompany}>{company}</Text>
        <Text style={styles.footerLine}>{email}</Text>
        <Text style={styles.footerLine}>{website}</Text>
        <Text style={styles.footerDisclaimer}>
          This is a computer-generated invoice. No signature required.
        </Text>
      </View>
      <View style={styles.footerRight}>
        <Text style={styles.footerLink}>Terms & Conditions</Text>
      </View>
    </View>
  );
}
