package javacodechecker; 


import java.io.BufferedWriter;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.Reader;

class ResourceLeak {  
	public void process1() {
		try {
			PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter("out.txt", true)));
			out.println("the text");
			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK
			out.close();  //close() is in try clause

			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
			FileOutputStream in = new FileOutputStream("xanadu.txt");
			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK
			in.close();
		} catch (IOException e) {
		}
	}

	public void processk() {
		// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
		PrintWriter out = null;
		try {
			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
			out = new PrintWriter(new File(""));
			out.println("the text");
		} catch (IOException e) {
		} finally {
			if(true) {
				// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
				out.close();	
			}
		}
	}
	
	public void testExceptionBlock() throws IOException {
		Reader reader = null;
		try {
			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
			reader = new FileReader("");
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			//Need to fix this
			reader.close();
		} finally {
			if (reader != null) {
				try {
					int k;
					int t;
					int kk;
					int tt;
					// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
					reader.close();
				} catch (IOException e) {
				} finally {
					
				}
			}
		}
	}
	
	//Non-compliant code
	//resource is not closed anywhere
	public void process2() {
		try {
			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK
			PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter("out.txt", true)));
			out.println("the text");
		} catch (IOException e) {
		}
	}

	public void process3() {
		// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
		try (PrintWriter out2 = new PrintWriter(new File(""))) {
//			out2.println("the text");
		} catch (IOException e) {
		}
	}
	
	PrintWriter outk = null;
	
	public void processK() {
		try {
			// EMB-ISSUE: CodeIssueNames.RESOURCE_LEAK/no-detect
			if(null != outk) 
				outk.close();
		} catch (Exception e) {
		}
	}
}