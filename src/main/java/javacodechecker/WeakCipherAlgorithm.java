package javacodechecker; 


import java.security.NoSuchAlgorithmException;

import javax.crypto.Cipher;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.NullCipher;

class WeakCipherAlgorithm {
    public static void main(String[] args) {

        final String RCVIER = "RC4";
        try {
            Cipher c1 = Cipher.getInstance("DES"); // Noncompliant: DES works with 56-bit keys allow attacks via exhaustive search
            Cipher c7 = NullCipher.getInstance("DESede"); // Noncompliant: Triple DES is vulnerable to meet-in-the-middle attack
            Cipher c13 = javax.crypto.Cipher.getInstance("RC2"); // Noncompliant: RC2 is vulnerable to a related-key attack
            Cipher c19 = Cipher.getInstance(RCVIER); // Noncompliant: vulnerable to several attacks (see https://en.wikipedia.org/wiki/RC4#Security)         Cipher c25 = Cipher.getInstance("Blowfish"); // Noncompliant: Blowfish use a 64-bit block size makes it vulnerable to birthday attacks          NullCipher nc = new NullCipher(); // Noncompliant: the NullCipher class provides an "identity cipher" one that does not transform or encrypt the plaintext in any way.
        } catch (NoSuchAlgorithmException | NoSuchPaddingException e) {
        	e.printStackTrace();
        }
    }
}