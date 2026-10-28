package com.securetravels.crm.lead;

/** One row of the source rollup. Names match the native query aliases. */
public interface LeadSourceCount {
    String getSource();
    long getTotal();
    long getOpen();
    long getQuoted();
    long getBooked();
    long getLost();
}
