package javacodechecker;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabasesShouldBePasswordProtected { 

	public void method() throws SQLException {
		String password = "password";
		
		//EMB-ISSUE:CodeIssueNames.DatabasesShouldBePasswordProtected
		Connection conn = DriverManager.getConnection("jdbc:derby:memory:myDB;create=true", "AppLogin", "");

		// Next 3 have password
		Connection conn1 = DriverManager.getConnection("jdbc:derby:memory:myDB;create=true", "AppLogin", password);
		Connection conn2 = DriverManager.getConnection("jdbc:derby:memory:myDB;create=true?user=user&password=text");
		Connection conn3 = DriverManager.getConnection("jdbc:derby:memory:myDB;create=true&password=text", "AppLogin", "");
		
		//EMB-ISSUE:CodeIssueNames.DatabasesShouldBePasswordProtected
		Connection conn4 = DriverManager.getConnection("jdbc:derby:memory:myDB;create=true?user=user&password=");
		
		//EMB-ISSUE:CodeIssueNames.DatabasesShouldBePasswordProtected
		Connection conn5 = DriverManager.getConnection("jdbc:derby:memory:myDB;create=true?user=user");
	}
}
