package javacodechecker;
import java.math.BigInteger;  
class BigIntegerInstantiation{
	public static void main(String args[]){  
		// EMB-ISSUE: CodeIssueNames.BIG_INTEGER_INSTANTIATION
        BigInteger bigInteger = new BigInteger("1");  
     // EMB-ISSUE: CodeIssueNames.BIG_INTEGER_INSTANTIATION
        BigInteger bigInteger1 = new BigInteger(1);  	
     // EMB-ISSUE: CodeIssueNames.BIG_INTEGER_INSTANTIATION
		BigInteger bigInteger2 = new BigInteger("0"); 
		// EMB-ISSUE: CodeIssueNames.BIG_INTEGER_INSTANTIATION/no-detect
		BigInteger bigInteger3 = BigInteger.ONE;
        int n=4;  
        for (int i = 2; i <=n ; i++){
            bigInteger = bigInteger.multiply(BigInteger.valueOf(i));  
        }  
        System.out.println("Factorial of 4 : "+bigInteger);  
    	
	}	
}