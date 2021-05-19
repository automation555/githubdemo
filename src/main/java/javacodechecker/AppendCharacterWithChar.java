import java.lang.*;
public class Test {
   public static void main(String args[]) {
      StringBuffer sb = new StringBuffer("Hi ");
   // EMB-ISSUE:CodeIssueNames.APPEND_CHARACTER_WITH_CHAR
      sb.append("u");
   // EMB-ISSUE:CodeIssueNames.APPEND_CHARACTER_WITH_CHAR/no-detect
      sb.append('r');
      System.out.println(sb);
           
      StringBuilder sbf11 = new StringBuilder("Java "); 
      CharSequence chSeq = "checks";
      // EMB-ISSUE:CodeIssueNames.APPEND_CHARACTER_WITH_CHAR/no-detect
      sbf.append(chSeq); 
      System.out.println(sbf11); 
   }
}